import { randomUUID } from "node:crypto";

import { getImageProvider } from "@/lib/ai";
import type { GeneratedImage } from "@/lib/ai/image-provider";
import {
  IMAGE_PROVIDER_INSUFFICIENT_CREDITS,
  imageProviderInsufficientCreditsMessage,
  isImageProviderInsufficientCreditsError
} from "@/lib/ai/provider-errors";
import { InsufficientCreditsError } from "@/lib/billing/credit-ledger";
import { MOCKUP_PACK_CREDIT_COST } from "@/lib/billing/plans";
import { createZipArchive } from "@/lib/export/zip";
import {
  claimFirestoreMockupJob,
  getFirestoreMockupJobForUser,
  saveFirestoreMockupJob,
  saveFirestoreMockupJobIfUnchanged
} from "@/lib/firestore/mockup-jobs";
import { listFirestoreArtworksForProject } from "@/lib/firestore/generation-jobs";
import {
  getFirestoreProjectForUser
} from "@/lib/firestore/projects";
import type { GeneratedArtworkPreview } from "@/lib/jobs/generation-types";
import type { JobStatus } from "@/lib/jobs/job-runner";
import type {
  MockupArtifactView,
  MockupImageView,
  MockupJobView
} from "@/lib/jobs/mockup-types";
import {
  commitLocalCredits,
  getLocalArtworkForUser,
  refundLocalCredits,
  reserveLocalCredits
} from "@/lib/jobs/local-generation-runner";
import { sanitizeFilename } from "@/lib/print/filenames";
import {
  isPrintRatioPresetKey,
  type PrintRatioPresetKey
} from "@/lib/print/presets";
import { buildEtsyMockupPrompt } from "@/lib/prompts/mockups";
import {
  createOptionalSignedDownloadUrl,
  getStorageProvider
} from "@/lib/storage";

type LocalMockupJob = {
  id: string;
  userId: string;
  projectId: string;
  projectName: string;
  artworkId: string;
  ratioKey: PrintRatioPresetKey | null;
  status: JobStatus;
  stage: string | null;
  creditCost: number;
  creditReserved: boolean;
  creditCommitted: boolean;
  creditRefunded: boolean;
  retryable: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  prompt: string;
  images: MockupImageView[];
  artifacts: MockupArtifactView[];
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  attemptCount: number;
};

type LocalMockupState = {
  jobs: Map<string, LocalMockupJob>;
};

type EnqueueLocalMockupInput = {
  userId: string;
  projectId: string;
  artworkId: string;
  ratioKey?: PrintRatioPresetKey;
};

type GlobalWithLocalMockupState = typeof globalThis & {
  __wallpackLocalMockupState?: LocalMockupState;
};

const MOCKUP_RESULT_COUNT = 5;
const DEFAULT_MOCKUP_JOB_TIMEOUT_MS = 15 * 60 * 1000;
const TERMINAL_STATUSES = new Set<JobStatus>([
  "succeeded",
  "failed",
  "cancelled"
]);

const globalWithState = globalThis as GlobalWithLocalMockupState;
const state =
  globalWithState.__wallpackLocalMockupState ??
  (globalWithState.__wallpackLocalMockupState = {
    jobs: new Map<string, LocalMockupJob>()
  });

export async function enqueueLocalMockupJob(input: EnqueueLocalMockupInput) {
  const project = await getFirestoreProjectForUser(
    input.userId,
    input.projectId
  );

  if (!project) {
    return {
      ok: false as const,
      code: "PROJECT_NOT_FOUND",
      message: "Project was not found for this account.",
      status: 404
    };
  }

  const artwork = await getArtworkForMockup({
    userId: input.userId,
    projectId: project.id,
    artworkId: input.artworkId
  });

  if (!artwork) {
    return {
      ok: false as const,
      code: "ARTWORK_NOT_FOUND",
      message: "Artwork was not found for this project.",
      status: 404
    };
  }

  const ratioKey =
    input.ratioKey && isPrintRatioPresetKey(input.ratioKey)
      ? input.ratioKey
      : null;
  const prompt = buildEtsyMockupPrompt({ project, ratioKey });
  const job: LocalMockupJob = {
    id: `mck_${randomUUID()}`,
    userId: input.userId,
    projectId: project.id,
    projectName: project.name,
    artworkId: artwork.artworkId,
    ratioKey,
    status: "queued",
    stage: "queued",
    creditCost: MOCKUP_PACK_CREDIT_COST,
    creditReserved: false,
    creditCommitted: false,
    creditRefunded: false,
    retryable: false,
    errorCode: null,
    errorMessage: null,
    prompt,
    images: [],
    artifacts: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: null,
    completedAt: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    attemptCount: 0
  };

  if (!shouldPreferFirestoreJobClaim()) {
    state.jobs.set(job.id, job);
  }
  await persistMockupJob(job);

  return { ok: true as const, job: toMockupJobView(job) };
}

export async function getLocalMockupJobForUser(jobId: string, userId: string) {
  const job = shouldPreferFirestoreJobClaim()
    ? undefined
    : state.jobs.get(jobId);

  if (job?.userId === userId) {
    await failTimedOutLocalMockupJob(job, { now: new Date() });
    await settleFailedLocalMockupJobRefund(job);
    return toMockupJobView(job);
  }

  const persistedJob = await getFirestoreMockupJobForUser(jobId, userId);

  if (!persistedJob) {
    return null;
  }

  const settledJob = await settleFailedPersistedMockupJobRefund(
    persistedJob,
    userId
  );

  return expireStalePersistedMockupJob(settledJob, userId);
}

export async function downloadLocalMockupArtifactForUser(input: {
  jobId: string;
  artifactId: string;
  userId: string;
}) {
  const job = await getLocalMockupJobForUser(input.jobId, input.userId);

  if (!job) {
    return null;
  }

  const artifact =
    job.artifacts.find(
      (candidate) => candidate.artifactId === input.artifactId
    ) ?? null;

  if (!artifact) {
    return null;
  }

  const object = await getStorageProvider().downloadObject(
    artifact.storagePath
  );

  return {
    fileName: artifact.fileName,
    contentType: artifact.contentType || object.contentType,
    bytes: object.bytes
  };
}

export async function downloadLocalMockupImageForUser(input: {
  jobId: string;
  imageId: string;
  userId: string;
}) {
  const job = await getLocalMockupJobForUser(input.jobId, input.userId);

  if (!job) {
    return null;
  }

  const image =
    job.images.find((candidate) => candidate.imageId === input.imageId) ??
    null;

  if (!image) {
    return null;
  }

  const object = await getStorageProvider().downloadObject(image.storagePath);

  return {
    fileName: image.fileName,
    contentType: image.contentType || object.contentType,
    bytes: object.bytes
  };
}

export async function retryLocalMockupJob(jobId: string, userId: string) {
  const job = await getLocalMockupJobForUser(jobId, userId);

  if (!job) {
    return {
      ok: false as const,
      code: "MOCKUP_JOB_NOT_FOUND",
      message: "Mockup job was not found.",
      status: 404
    };
  }

  if (job.status !== "failed" || !job.retryable) {
    return {
      ok: false as const,
      code: "RETRY_NOT_ALLOWED",
      message: "Only failed retryable mockup jobs can be retried.",
      status: 409
    };
  }

  return enqueueLocalMockupJob({
    userId,
    projectId: job.projectId,
    artworkId: job.artworkId,
    ratioKey: job.ratioKey ?? undefined
  });
}

export async function waitForLocalMockupJob(
  jobId: string,
  options: { timeoutMs?: number; intervalMs?: number } = {}
) {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const intervalMs = options.intervalMs ?? 100;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const job = state.jobs.get(jobId);

    if (job && TERMINAL_STATUSES.has(job.status)) {
      return toMockupJobView(job);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for mockup job ${jobId}`);
}

async function claimMockupJob(
  jobId: string,
  options: { leaseOwner: string }
): Promise<LocalMockupJob | null> {
  const localJob = shouldPreferFirestoreJobClaim()
    ? undefined
    : state.jobs.get(jobId);
  const now = new Date();

  if (localJob) {
    if (localJob.status !== "queued") {
      return null;
    }

    localJob.status = "validating";
    localJob.stage = "credit_reservation";
    localJob.startedAt = localJob.startedAt ?? now;
    localJob.leaseOwner = options.leaseOwner;
    localJob.leaseExpiresAt = new Date(now.getTime() + getMockupJobTimeoutMs());
    localJob.attemptCount += 1;
    await persistMockupJob(localJob);

    return localJob;
  }

  const record = await claimFirestoreMockupJob(jobId, {
    leaseOwner: options.leaseOwner,
    leaseMs: getMockupJobTimeoutMs(),
    now
  });

  if (!record) {
    return null;
  }

  return localMockupJobFromView(record.job, record.userId);
}

function shouldPreferFirestoreJobClaim() {
  return (
    process.env.NODE_ENV !== "test" && process.env.JOB_RUNNER === "cloud-tasks"
  );
}

export async function processMockupJob(
  jobId: string,
  options: { leaseOwner?: string } = {}
) {
  const job = await claimMockupJob(jobId, {
    leaseOwner: options.leaseOwner ?? `worker_${randomUUID()}`
  });

  if (!job) {
    return { processed: false as const, job: null };
  }

  const timeout =
    !shouldPreferFirestoreJobClaim() && state.jobs.has(jobId)
      ? scheduleLocalMockupTimeout(job)
      : null;

  try {
    await reserveLocalCredits({
      userId: job.userId,
      amount: job.creditCost,
      reason: "Mockup pack generation",
      idempotencyKey: `${job.id}:reserve`,
      relatedJobId: job.id
    });
    job.creditReserved = true;
    await persistMockupJob(job);

    if (isMockupJobTerminal(job)) {
      await refundMockupJobCredits(job, "Mockup pack generation failed");
      await persistMockupJob(job);
      return { processed: false as const, job: toMockupJobView(job) };
    }

    job.status = "running";
    job.stage = "source_download";
    await persistMockupJob(job);

    const project = await getRequiredProject(job);
    const artwork = await getRequiredArtwork(job);
    const referenceImage = await loadMockupReferenceImage(artwork, job.ratioKey);

    job.stage = "provider_generation";
    await persistMockupJob(job);

    const images = await getImageProvider().generate({
      prompt: job.prompt,
      count: MOCKUP_RESULT_COUNT,
      aspectRatio: "1x1",
      referenceImages: [referenceImage.dataUri]
    });

    if (images.length < MOCKUP_RESULT_COUNT) {
      throw new Error(
        `Image provider returned ${images.length} of ${MOCKUP_RESULT_COUNT} requested mockups.`
      );
    }

    job.status = "uploading";
    job.stage = "storage_upload";
    await persistMockupJob(job);

    job.images = await uploadMockupImages({
      userId: job.userId,
      projectId: job.projectId,
      jobId: job.id,
      projectName: project.name,
      images: images.slice(0, MOCKUP_RESULT_COUNT)
    });
    job.artifacts = await uploadMockupZip({
      userId: job.userId,
      projectId: job.projectId,
      jobId: job.id,
      projectName: project.name,
      images: job.images
    });

    await commitLocalCredits({
      userId: job.userId,
      reason: "Mockup pack generation succeeded",
      idempotencyKey: `${job.id}:commit`,
      relatedJobId: job.id
    });
    job.creditCommitted = true;
    job.status = "succeeded";
    job.stage = "complete";
    job.completedAt = new Date();
    await persistMockupJob(job);

    return { processed: true as const, job: toMockupJobView(job) };
  } catch (error) {
    if (isMockupJobTerminal(job)) {
      return { processed: false as const, job: toMockupJobView(job) };
    }

    job.status = "failed";
    job.stage = "failed";
    const failure = mockupFailureFromError(error);
    job.errorCode = failure.code;
    job.errorMessage = failure.message;
    job.retryable = failure.retryable;
    job.completedAt = new Date();
    try {
      await refundMockupJobCredits(job, "Mockup pack generation failed");
    } finally {
      await persistMockupJob(job).catch(() => undefined);
    }

    return { processed: true as const, job: toMockupJobView(job) };
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function processLocalMockupJob(jobId: string) {
  return processMockupJob(jobId);
}

function mockupFailureFromError(error: unknown) {
  if (error instanceof InsufficientCreditsError) {
    return {
      code: "INSUFFICIENT_CREDITS",
      message: error.message,
      retryable: false
    };
  }

  if (isImageProviderInsufficientCreditsError(error)) {
    return {
      code: IMAGE_PROVIDER_INSUFFICIENT_CREDITS,
      message: imageProviderInsufficientCreditsMessage("Mockup generation"),
      retryable: true
    };
  }

  return {
    code: "MOCKUP_GENERATION_FAILED",
    message:
      error instanceof Error
        ? error.message
        : "Mockup generation failed unexpectedly.",
    retryable: true
  };
}

export function isStaleMockupJobView(
  job: Pick<MockupJobView, "createdAt" | "startedAt" | "status" | "updatedAt">,
  options: { now?: Date; timeoutMs?: number } = {}
) {
  if (TERMINAL_STATUSES.has(job.status)) {
    return false;
  }

  const lastActivityAt =
    timestampFromIso(job.updatedAt) ??
    timestampFromIso(job.startedAt) ??
    timestampFromIso(job.createdAt);

  if (lastActivityAt === null) {
    return false;
  }

  const now = options.now ?? new Date();
  const timeoutMs = options.timeoutMs ?? getMockupJobTimeoutMs();

  return now.getTime() - lastActivityAt >= timeoutMs;
}

async function expireStalePersistedMockupJob(
  job: MockupJobView,
  userId: string
) {
  if (!isStaleMockupJobView(job)) {
    return job;
  }

  const timedOutJob = timedOutMockupJobView(job, new Date());
  const timeoutClaim = await saveFirestoreMockupJobIfUnchanged(timedOutJob, {
    userId,
    expectedStatus: job.status,
    expectedUpdatedAt: job.updatedAt
  });

  if (!timeoutClaim.saved) {
    return timeoutClaim.job ?? job;
  }

  if (shouldRefundFailedMockupJob(timedOutJob)) {
    await refundLocalCredits({
      userId,
      amount: timedOutJob.creditCost,
      reason: "Mockup pack generation timed out",
      idempotencyKey: `${timedOutJob.jobId}:refund`,
      relatedJobId: timedOutJob.jobId
    });
    const refundedJob = {
      ...timedOutJob,
      creditRefunded: true,
      updatedAt: new Date().toISOString()
    };

    await saveFirestoreMockupJob(refundedJob, { userId });
    return refundedJob;
  }

  return timedOutJob;
}

function scheduleLocalMockupTimeout(job: LocalMockupJob) {
  const timeout = setTimeout(() => {
    void failTimedOutLocalMockupJob(job, {
      force: true,
      now: new Date()
    }).catch(() => undefined);
  }, getMockupJobTimeoutMs());

  if (typeof timeout === "object" && "unref" in timeout) {
    timeout.unref();
  }

  return timeout;
}

async function failTimedOutLocalMockupJob(
  job: LocalMockupJob,
  options: { force?: boolean; now: Date }
) {
  if (isMockupJobTerminal(job)) {
    return false;
  }

  if (!options.force && !isStaleLocalMockupJob(job, options.now)) {
    return false;
  }

  job.status = "failed";
  job.stage = "timed_out";
  job.errorCode = "MOCKUP_TIMEOUT";
  job.errorMessage =
    "Mockup job timed out before it finished. Any reserved credits were refunded. Please retry the mockup pack.";
  job.retryable = true;
  job.completedAt = options.now;
  try {
    await refundMockupJobCredits(job, "Mockup pack generation timed out");
  } finally {
    await persistMockupJob(job);
  }

  return true;
}

async function refundMockupJobCredits(job: LocalMockupJob, reason: string) {
  if (!job.creditReserved || job.creditCommitted || job.creditRefunded) {
    return;
  }

  await refundLocalCredits({
    userId: job.userId,
    amount: job.creditCost,
    reason,
    idempotencyKey: `${job.id}:refund`,
    relatedJobId: job.id
  });
  job.creditRefunded = true;
}

async function settleFailedLocalMockupJobRefund(job: LocalMockupJob) {
  if (!shouldRefundFailedMockupJob(job)) {
    return;
  }

  await refundMockupJobCredits(job, "Mockup pack generation failed");
  await persistMockupJob(job);
}

async function settleFailedPersistedMockupJobRefund(
  job: MockupJobView,
  userId: string
) {
  if (!shouldRefundFailedMockupJob(job)) {
    return job;
  }

  const settledJob = {
    ...job,
    creditRefunded: true,
    updatedAt: new Date().toISOString()
  };

  await refundLocalCredits({
    userId,
    amount: job.creditCost,
    reason: "Mockup pack generation failed",
    idempotencyKey: `${job.jobId}:refund`,
    relatedJobId: job.jobId
  });
  await saveFirestoreMockupJob(settledJob, { userId });

  return settledJob;
}

function shouldRefundFailedMockupJob(
  job: Pick<
    MockupJobView,
    "creditCommitted" | "creditRefunded" | "creditReserved" | "status"
  >
) {
  return (
    job.status === "failed" &&
    job.creditReserved &&
    !job.creditCommitted &&
    !job.creditRefunded
  );
}

function timedOutMockupJobView(job: MockupJobView, now: Date): MockupJobView {
  const timestamp = now.toISOString();

  return {
    ...job,
    status: "failed",
    stage: "timed_out",
    retryable: true,
    errorCode: "MOCKUP_TIMEOUT",
    errorMessage:
      "Mockup job timed out before it finished. Any reserved credits were refunded. Please retry the mockup pack.",
    updatedAt: timestamp,
    completedAt: timestamp
  };
}

function isStaleLocalMockupJob(job: LocalMockupJob, now: Date) {
  return isStaleMockupJobView(toMockupJobView(job), { now });
}

function isMockupJobTerminal(job: { status: JobStatus }) {
  return TERMINAL_STATUSES.has(job.status);
}

function timestampFromIso(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? null : timestamp;
}

function getMockupJobTimeoutMs() {
  return readPositiveIntegerEnv(
    "MOCKUP_JOB_TIMEOUT_MS",
    DEFAULT_MOCKUP_JOB_TIMEOUT_MS
  );
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function getRequiredProject(job: LocalMockupJob) {
  const project = await getFirestoreProjectForUser(job.userId, job.projectId);

  if (!project) {
    throw new Error("Project was not found for this account.");
  }

  return project;
}

async function getRequiredArtwork(job: LocalMockupJob) {
  const artwork = await getArtworkForMockup({
    userId: job.userId,
    projectId: job.projectId,
    artworkId: job.artworkId
  });

  if (!artwork) {
    throw new Error("Artwork was not found for this project.");
  }

  return artwork;
}

async function getArtworkForMockup(input: {
  userId: string;
  projectId: string;
  artworkId: string;
}) {
  const localArtwork = getLocalArtworkForUser(input);

  if (localArtwork) {
    return localArtwork;
  }

  const artworks = await listFirestoreArtworksForProject(
    input.userId,
    input.projectId
  );

  return (
    artworks.find((artwork) => artwork.artworkId === input.artworkId) ?? null
  );
}

async function loadMockupReferenceImage(
  artwork: GeneratedArtworkPreview,
  ratioKey: PrintRatioPresetKey | null
) {
  const ratioSource = ratioKey
    ? artwork.dimensionPreviews?.find(
        (candidate) =>
          candidate.ratioKey === ratioKey &&
          (candidate.sourceDataUrl || candidate.sourceStoragePath)
      )
    : null;

  if (ratioSource?.sourceDataUrl) {
    return {
      dataUri: ratioSource.sourceDataUrl
    };
  }

  if (ratioSource?.sourceStoragePath) {
    const object = await getStorageProvider().downloadObject(
      ratioSource.sourceStoragePath
    );

    return {
      dataUri: bytesToDataUri(object.bytes, object.contentType)
    };
  }

  if (artwork.dataUrl) {
    return {
      dataUri: artwork.dataUrl
    };
  }

  if (!artwork.sourceStoragePath) {
    throw new Error("Artwork source file is unavailable.");
  }

  const object = await getStorageProvider().downloadObject(
    artwork.sourceStoragePath
  );

  return {
    dataUri: bytesToDataUri(object.bytes, object.contentType)
  };
}

async function uploadMockupImages(input: {
  userId: string;
  projectId: string;
  jobId: string;
  projectName: string;
  images: GeneratedImage[];
}) {
  return Promise.all(
    input.images.map(async (image, index) => {
      const extension = extensionFromMimeType(image.mimeType);
      const imageNumber = index + 1;
      const fileName = sanitizeFilename(
        `${input.projectName}_mockup_${imageNumber}.${extension}`,
        `mockup-${imageNumber}.${extension}`
      );
      const storagePath = [
        "mockups",
        safeStorageSegment(input.userId),
        safeStorageSegment(input.projectId),
        safeStorageSegment(input.jobId),
        fileName
      ].join("/");

      await getStorageProvider().uploadObject({
        path: storagePath,
        bytes: image.bytes,
        contentType: image.mimeType,
        metadata: {
          projectId: input.projectId,
          mockupJobId: input.jobId,
          providerRequestId: image.providerRequestId ?? ""
        }
      });

      const signedUrl = await createOptionalSignedDownloadUrl(storagePath);

      return {
        imageId: `mcki_${randomUUID()}`,
        fileName,
        storagePath,
        contentType: image.mimeType,
        bytes: image.bytes.byteLength,
        width: image.width,
        height: image.height,
        providerRequestId: image.providerRequestId,
        usage: image.usage,
        previewUrl: signedUrl?.url,
        previewUrlExpiresAt: signedUrl?.expiresAt.toISOString(),
        createdAt: new Date().toISOString()
      };
    })
  );
}

async function uploadMockupZip(input: {
  userId: string;
  projectId: string;
  jobId: string;
  projectName: string;
  images: MockupImageView[];
}): Promise<MockupArtifactView[]> {
  const files = await Promise.all(
    input.images.map(async (image) => {
      const object = await getStorageProvider().downloadObject(
        image.storagePath
      );

      return {
        path: image.fileName,
        bytes: object.bytes
      };
    })
  );
  const zipBytes = createZipArchive(files);
  const fileName = sanitizeFilename(
    `${input.projectName}_mockups.zip`,
    "WallPackAI_Mockups.zip"
  );
  const storagePath = [
    "mockups",
    safeStorageSegment(input.userId),
    safeStorageSegment(input.projectId),
    safeStorageSegment(input.jobId),
    fileName
  ].join("/");

  await getStorageProvider().uploadObject({
    path: storagePath,
    bytes: zipBytes,
    contentType: "application/zip",
    metadata: {
      projectId: input.projectId,
      mockupJobId: input.jobId
    }
  });

  const signedUrl = await createOptionalSignedDownloadUrl(storagePath, {
    ttlSeconds: 60 * 60
  });

  return [
    {
      artifactId: `mcka_${randomUUID()}`,
      kind: "mockup_zip",
      fileName,
      storagePath,
      contentType: "application/zip",
      bytes: zipBytes.byteLength,
      downloadUrl: signedUrl?.url,
      downloadUrlExpiresAt: signedUrl?.expiresAt.toISOString(),
      createdAt: new Date().toISOString()
    }
  ];
}

function bytesToDataUri(bytes: Buffer | Uint8Array, contentType: string) {
  return `data:${mimeTypeFromContentType(contentType)};base64,${Buffer.from(
    bytes
  ).toString("base64")}`;
}

function mimeTypeFromContentType(contentType: string) {
  if (contentType.includes("png")) {
    return "image/png";
  }

  if (contentType.includes("webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}

function extensionFromMimeType(mimeType: GeneratedImage["mimeType"]) {
  if (mimeType === "image/png") {
    return "png";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function toMockupJobView(job: LocalMockupJob): MockupJobView {
  return {
    jobId: job.id,
    projectId: job.projectId,
    projectName: job.projectName,
    artworkId: job.artworkId,
    ratioKey: job.ratioKey,
    status: job.status,
    stage: job.stage,
    creditCost: job.creditCost,
    creditReserved: job.creditReserved,
    creditCommitted: job.creditCommitted,
    creditRefunded: job.creditRefunded,
    retryable: job.retryable,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    prompt: job.prompt,
    images: job.images,
    artifacts: job.artifacts,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    leaseOwner: job.leaseOwner,
    leaseExpiresAt: job.leaseExpiresAt?.toISOString() ?? null,
    attemptCount: job.attemptCount
  };
}

function localMockupJobFromView(
  job: MockupJobView,
  userId: string
): LocalMockupJob {
  return {
    id: job.jobId,
    userId,
    projectId: job.projectId,
    projectName: job.projectName,
    artworkId: job.artworkId,
    ratioKey: job.ratioKey,
    status: job.status,
    stage: job.stage,
    creditCost: job.creditCost,
    creditReserved: job.creditReserved,
    creditCommitted: job.creditCommitted,
    creditRefunded: job.creditRefunded,
    retryable: job.retryable,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    prompt: job.prompt,
    images: job.images,
    artifacts: job.artifacts,
    createdAt: dateFromIso(job.createdAt),
    updatedAt: dateFromIso(job.updatedAt),
    startedAt: nullableDateFromIso(job.startedAt),
    completedAt: nullableDateFromIso(job.completedAt),
    leaseOwner: job.leaseOwner,
    leaseExpiresAt: nullableDateFromIso(job.leaseExpiresAt),
    attemptCount: job.attemptCount
  };
}

async function persistMockupJob(job: LocalMockupJob) {
  job.updatedAt = new Date();
  await saveFirestoreMockupJob(toMockupJobView(job), {
    userId: job.userId
  });
}

function safeStorageSegment(value: string) {
  return sanitizeFilename(value, "wallpack").replaceAll(".", "-");
}

function dateFromIso(value: string) {
  return nullableDateFromIso(value) ?? new Date(0);
}

function nullableDateFromIso(value: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value);

  return Number.isNaN(timestamp.getTime()) ? null : timestamp;
}
