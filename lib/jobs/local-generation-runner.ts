import { randomUUID } from "node:crypto";

import { getImageProvider } from "@/lib/ai";
import type { GeneratedImage } from "@/lib/ai/image-provider";
import { RUNWARE_GPT_IMAGE_AIR_ID } from "@/lib/ai/providers/runware";
import {
  InMemoryCreditLedger,
  InsufficientCreditsError
} from "@/lib/billing/credit-ledger";
import {
  commitFirestoreCredits,
  getFirestoreCreditBalance,
  refundFirestoreCredits,
  reserveFirestoreCredits
} from "@/lib/billing/firestore-credit-ledger";
import {
  getFirestoreGenerationJobForUser,
  saveFirestoreGenerationJob
} from "@/lib/firestore/generation-jobs";
import {
  getFirestoreProjectForUser,
  markFirestoreProjectGenerating,
  markFirestoreProjectStatus
} from "@/lib/firestore/projects";
import type {
  GeneratedArtworkPreview,
  GenerationJobView,
  GenerationQuality
} from "@/lib/jobs/generation-types";
import type { JobStatus } from "@/lib/jobs/job-runner";
import { sanitizeFilename } from "@/lib/print/filenames";
import { buildWallArtPrompt } from "@/lib/prompts/builder";
import { promptInputSchema, type PromptInput } from "@/lib/prompts/schema";
import { getStorageProvider } from "@/lib/storage";

type LocalGenerationJob = {
  id: string;
  userId: string;
  projectId: string;
  projectName: string;
  status: JobStatus;
  stage: string | null;
  requestedCount: number;
  creditCost: number;
  creditReserved: boolean;
  creditCommitted: boolean;
  prompt: string;
  negativePrompt: string;
  primaryRatio: string;
  quality: GenerationQuality;
  provider: string;
  model: string;
  retryable: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  artworks: GeneratedArtworkPreview[];
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

type LocalGenerationState = {
  jobs: Map<string, LocalGenerationJob>;
  ledger: InMemoryCreditLedger;
};

type GlobalWithLocalGenerationState = typeof globalThis & {
  __wallpackLocalGenerationState?: LocalGenerationState;
};

type EnqueueLocalGenerationInput = {
  userId: string;
  projectId?: string;
  projectName?: string;
  promptInputs: PromptInput;
  previewCount: number;
  creditCost?: number;
  quality?: GenerationQuality;
};

const DEFAULT_DEV_CREDITS = 50;
const TERMINAL_STATUSES = new Set<JobStatus>([
  "succeeded",
  "failed",
  "cancelled"
]);

const globalWithState = globalThis as GlobalWithLocalGenerationState;

const state =
  globalWithState.__wallpackLocalGenerationState ??
  (globalWithState.__wallpackLocalGenerationState = {
    jobs: new Map<string, LocalGenerationJob>(),
    ledger: new InMemoryCreditLedger()
  });

export async function enqueueLocalGenerationJob(
  input: EnqueueLocalGenerationInput
) {
  const parsedPromptInputs = promptInputSchema.parse(input.promptInputs);
  const builtPrompt = buildWallArtPrompt(parsedPromptInputs);
  const previewCount = clampPreviewCount(input.previewCount);
  const projectId = input.projectId ?? `local_${randomUUID()}`;
  const projectName =
    input.projectName ??
    parsedPromptInputs.packName ??
    "Untitled wall-art pack";
  const provider =
    process.env.IMAGE_PROVIDER === "runware" ? "runware" : "mock";
  const job: LocalGenerationJob = {
    id: `gen_${randomUUID()}`,
    userId: input.userId,
    projectId,
    projectName,
    status: "queued",
    stage: "queued",
    requestedCount: previewCount,
    creditCost: input.creditCost ?? previewCount,
    creditReserved: false,
    creditCommitted: false,
    prompt: builtPrompt.prompt,
    negativePrompt: builtPrompt.negativePrompt,
    primaryRatio: parsedPromptInputs.primaryRatio,
    quality: input.quality ?? "draft",
    provider,
    model:
      provider === "runware"
        ? (process.env.RUNWARE_AIR_ID ?? RUNWARE_GPT_IMAGE_AIR_ID)
        : "mock-wall-art-preview",
    retryable: false,
    errorCode: null,
    errorMessage: null,
    artworks: [],
    createdAt: new Date(),
    startedAt: null,
    completedAt: null
  };

  state.jobs.set(job.id, job);
  await persistGenerationJob(job);
  await persistProjectGenerating(job);

  setTimeout(() => {
    void processLocalGenerationJob(job.id);
  }, 0);

  return {
    jobId: job.id,
    status: job.status,
    projectId: job.projectId
  };
}

export async function getLocalGenerationJobForUser(
  jobId: string,
  userId: string
) {
  const job = state.jobs.get(jobId);

  if (job?.userId === userId) {
    return toGenerationJobView(job);
  }

  return getFirestoreGenerationJobForUser(jobId, userId);
}

export async function cancelLocalGenerationJob(jobId: string, userId: string) {
  const job = state.jobs.get(jobId);

  if (!job) {
    const persistedJob = await getFirestoreGenerationJobForUser(jobId, userId);

    if (!persistedJob) {
      return {
        ok: false as const,
        code: "GENERATION_JOB_NOT_FOUND",
        message: "Generation job was not found.",
        status: 404
      };
    }

    return cannotCancelResult(persistedJob.status);
  }

  if (job.userId !== userId) {
    return {
      ok: false as const,
      code: "GENERATION_JOB_NOT_FOUND",
      message: "Generation job was not found.",
      status: 404
    };
  }

  if (job.status !== "queued" && job.status !== "validating") {
    return cannotCancelResult(job.status);
  }

  if (job.creditReserved && !job.creditCommitted) {
    state.ledger.refund({
      userId: job.userId,
      amount: job.creditCost,
      reason: "Preview generation cancelled",
      idempotencyKey: `${job.id}:cancel-refund`,
      relatedJobId: job.id
    });
  }

  job.status = "cancelled";
  job.stage = "cancelled";
  job.retryable = true;
  job.completedAt = new Date();
  await persistGenerationJob(job);
  await persistProjectStatus(job, "draft");

  return { ok: true as const, job: toGenerationJobView(job) };
}

export async function retryLocalGenerationJob(jobId: string, userId: string) {
  const job = await getLocalGenerationJobForUser(jobId, userId);

  if (!job) {
    return {
      ok: false as const,
      code: "GENERATION_JOB_NOT_FOUND",
      message: "Generation job was not found.",
      status: 404
    };
  }

  if (job.status !== "failed" || !job.retryable) {
    return {
      ok: false as const,
      code: "RETRY_NOT_ALLOWED",
      message: "Only failed retryable generation jobs can be retried.",
      status: 409
    };
  }

  const project = await getFirestoreProjectForUser(userId, job.projectId);

  if (!project) {
    return {
      ok: false as const,
      code: "PROJECT_NOT_FOUND",
      message: "Project was not found for this account.",
      status: 404
    };
  }

  const queued = await enqueueLocalGenerationJob({
    userId,
    projectId: project.id,
    projectName: project.name,
    promptInputs: project.promptInputs,
    previewCount: job.requestedCount,
    quality: job.quality
  });

  return { ok: true as const, job: queued };
}

export async function waitForLocalGenerationJob(
  jobId: string,
  options: { timeoutMs?: number; intervalMs?: number } = {}
) {
  const timeoutMs = options.timeoutMs ?? 5_000;
  const intervalMs = options.intervalMs ?? 25;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const job = state.jobs.get(jobId);

    if (job && TERMINAL_STATUSES.has(job.status)) {
      return toGenerationJobView(job);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for generation job ${jobId}`);
}

export function getLocalCreditBalance(userId: string) {
  ensureDevCredits(userId);
  return state.ledger.getBalance(userId);
}

export async function getCreditBalance(userId: string) {
  if (shouldUseInMemoryCreditLedger()) {
    return getLocalCreditBalance(userId);
  }

  return getFirestoreCreditBalance(userId);
}

export async function reserveLocalCredits(input: {
  userId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
  relatedJobId?: string;
}) {
  if (input.amount <= 0) {
    return;
  }

  if (!shouldUseInMemoryCreditLedger()) {
    await reserveFirestoreCredits(input);
    return;
  }

  ensureDevCredits(input.userId);
  state.ledger.reserve(input);
}

export async function commitLocalCredits(input: {
  userId: string;
  reason: string;
  idempotencyKey: string;
  relatedJobId?: string;
}) {
  if (!shouldUseInMemoryCreditLedger()) {
    await commitFirestoreCredits(input);
    return;
  }

  state.ledger.commit(input);
}

export async function refundLocalCredits(input: {
  userId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
  relatedJobId?: string;
}) {
  if (input.amount <= 0) {
    return;
  }

  if (!shouldUseInMemoryCreditLedger()) {
    await refundFirestoreCredits(input);
    return;
  }

  state.ledger.refund(input);
}

export function getLocalArtworkForUser(input: {
  userId: string;
  projectId: string;
  artworkId: string;
}): GeneratedArtworkPreview | null {
  for (const job of state.jobs.values()) {
    if (job.userId !== input.userId || job.projectId !== input.projectId) {
      continue;
    }

    const artwork = job.artworks.find(
      (candidate) => candidate.artworkId === input.artworkId
    );

    if (artwork) {
      return artwork;
    }
  }

  return null;
}

async function processLocalGenerationJob(jobId: string) {
  const job = state.jobs.get(jobId);

  if (!job || job.status !== "queued") {
    return;
  }

  job.status = "validating";
  job.stage = "credit_reservation";
  job.startedAt = new Date();
  await persistGenerationJob(job);

  try {
    if (isGenerationJobCancelled(job)) {
      return;
    }

    await reserveLocalCredits({
      userId: job.userId,
      amount: job.creditCost,
      reason: "Preview generation",
      idempotencyKey: `${job.id}:reserve`,
      relatedJobId: job.id
    });
    job.creditReserved = job.creditCost > 0;
    await persistGenerationJob(job);

    if (isGenerationJobCancelled(job)) {
      return;
    }

    job.status = "running";
    job.stage = "provider_generation";
    await persistGenerationJob(job);

    const images = await getImageProvider().generate({
      prompt: job.prompt,
      negativePrompt: job.negativePrompt,
      count: job.requestedCount,
      aspectRatio: job.primaryRatio
    });

    job.status = "processing";
    job.stage = "preview_packaging";
    await persistGenerationJob(job);
    job.status = "uploading";
    job.stage = "storage_upload";
    await persistGenerationJob(job);
    job.artworks = await Promise.all(
      images.map((image, index) =>
        toArtworkPreview(image, {
          index,
          userId: job.userId,
          projectId: job.projectId,
          jobId: job.id
        })
      )
    );

    if (job.creditReserved) {
      await commitLocalCredits({
        userId: job.userId,
        reason: "Preview generation succeeded",
        idempotencyKey: `${job.id}:commit`,
        relatedJobId: job.id
      });
      job.creditCommitted = true;
    }
    job.status = "succeeded";
    job.stage = "complete";
    job.completedAt = new Date();
    await persistGenerationJob(job);
    await persistProjectGenerated(job, "ready");
  } catch (error) {
    if (job.creditReserved && !job.creditCommitted) {
      await refundLocalCredits({
        userId: job.userId,
        amount: job.creditCost,
        reason: "Preview generation failed",
        idempotencyKey: `${job.id}:refund`,
        relatedJobId: job.id
      });
    }

    job.status = "failed";
    job.stage = "failed";
    job.errorCode =
      error instanceof InsufficientCreditsError
        ? "INSUFFICIENT_CREDITS"
        : "GENERATION_FAILED";
    job.errorMessage =
      error instanceof Error
        ? error.message
        : "Generation failed unexpectedly.";
    job.retryable = !(error instanceof InsufficientCreditsError);
    job.completedAt = new Date();
    await persistGenerationJob(job).catch(() => undefined);
    await persistProjectGenerated(job, "failed").catch(() => undefined);
  }
}

function shouldUseInMemoryCreditLedger() {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.CREDIT_LEDGER_PROVIDER === "memory"
  );
}

function ensureDevCredits(userId: string) {
  state.ledger.grant({
    userId,
    amount: readPositiveIntegerEnv(
      "LOCAL_GENERATION_DEV_CREDITS",
      DEFAULT_DEV_CREDITS
    ),
    reason: "Local generation development credits",
    idempotencyKey: `local-generation-dev-grant:${userId}`
  });
}

async function toArtworkPreview(
  image: GeneratedImage,
  input: { index: number; userId: string; projectId: string; jobId: string }
): Promise<GeneratedArtworkPreview> {
  const artworkId = `art_${randomUUID()}`;
  const extension = extensionFromMimeType(image.mimeType);
  const storagePath = [
    "sources",
    safeStorageSegment(input.userId),
    safeStorageSegment(input.projectId),
    safeStorageSegment(artworkId),
    `source-${input.index + 1}.${extension}`
  ].join("/");

  if (process.env.NODE_ENV !== "test") {
    await getStorageProvider().uploadObject({
      path: storagePath,
      bytes: image.bytes,
      contentType: image.mimeType,
      metadata: {
        projectId: input.projectId,
        generationJobId: input.jobId,
        artworkId,
        providerRequestId: image.providerRequestId ?? ""
      }
    });
    const signedUrl =
      await getStorageProvider().createSignedDownloadUrl(storagePath);

    return {
      artworkId,
      previewUrl: signedUrl.url,
      previewUrlExpiresAt: signedUrl.expiresAt.toISOString(),
      width: image.width,
      height: image.height,
      mimeType: image.mimeType,
      providerRequestId: image.providerRequestId,
      sourceStoragePath: storagePath,
      previewStoragePath: storagePath,
      createdAt: new Date().toISOString()
    };
  }

  return {
    artworkId,
    dataUrl: `data:${image.mimeType};base64,${Buffer.from(image.bytes).toString(
      "base64"
    )}`,
    width: image.width,
    height: image.height,
    mimeType: image.mimeType,
    providerRequestId: image.providerRequestId,
    sourceStoragePath: storagePath,
    previewStoragePath: storagePath,
    createdAt: new Date().toISOString()
  };
}

function toGenerationJobView(job: LocalGenerationJob): GenerationJobView {
  return {
    jobId: job.id,
    projectId: job.projectId,
    projectName: job.projectName,
    status: job.status,
    stage: job.stage,
    requestedCount: job.requestedCount,
    creditCost: job.creditCost,
    creditReserved: job.creditReserved,
    creditCommitted: job.creditCommitted,
    prompt: job.prompt,
    negativePrompt: job.negativePrompt,
    primaryRatio: job.primaryRatio,
    quality: job.quality,
    retryable: job.retryable,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    artworks: job.artworks,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null
  };
}

function clampPreviewCount(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(4, Math.trunc(value)));
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function persistGenerationJob(job: LocalGenerationJob) {
  await saveFirestoreGenerationJob(toGenerationJobView(job), {
    userId: job.userId
  });
}

async function persistProjectGenerating(job: LocalGenerationJob) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  await markFirestoreProjectGenerating({
    projectId: job.projectId,
    userId: job.userId,
    generationJobId: job.id
  });
}

async function persistProjectGenerated(
  job: LocalGenerationJob,
  status: "ready" | "failed"
) {
  await persistProjectStatus(job, status);
}

async function persistProjectStatus(
  job: LocalGenerationJob,
  status: "draft" | "ready" | "failed"
) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  await markFirestoreProjectStatus({
    projectId: job.projectId,
    userId: job.userId,
    status
  });
}

function cannotCancelResult(status: JobStatus) {
  return {
    ok: false as const,
    code: "CANNOT_CANCEL",
    message: `Generation job cannot be cancelled while it is ${status}.`,
    status: 409
  };
}

function isGenerationJobCancelled(job: LocalGenerationJob) {
  return job.status === "cancelled";
}

function extensionFromMimeType(mimeType: GeneratedImage["mimeType"]) {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "png";
}

function safeStorageSegment(value: string) {
  return sanitizeFilename(value, "wallpack").replaceAll(".", "-");
}
