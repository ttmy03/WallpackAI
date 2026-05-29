import { randomUUID } from "node:crypto";

import sharp from "sharp";

import { getImageProvider } from "@/lib/ai";
import type { GeneratedImage, ImageProvider } from "@/lib/ai/image-provider";
import {
  IMAGE_PROVIDER_INSUFFICIENT_CREDITS,
  imageProviderInsufficientCreditsMessage,
  isImageProviderInsufficientCreditsError
} from "@/lib/ai/provider-errors";
import { RUNWARE_GPT_IMAGE_AIR_ID } from "@/lib/ai/providers/runware";
import {
  InMemoryCreditLedger,
  InsufficientCreditsError
} from "@/lib/billing/credit-ledger";
import { generationCreditCostForPreviewCount } from "@/lib/billing/plans";
import {
  commitFirestoreCredits,
  getFirestoreCreditBalance,
  refundFirestoreCredits,
  reserveFirestoreCredits
} from "@/lib/billing/firestore-credit-ledger";
import {
  claimFirestoreGenerationJob,
  getFirestoreGenerationJobForUser,
  saveFirestoreGenerationJob
} from "@/lib/firestore/generation-jobs";
import {
  getFirestoreProjectForUser,
  markFirestoreProjectGenerating,
  markFirestoreProjectStatus
} from "@/lib/firestore/projects";
import { fitImageWithinCanvas } from "@/lib/image/fit";
import type {
  GeneratedArtworkDimensionPreview,
  GeneratedArtworkPreview,
  GenerationJobView,
  GenerationQuality
} from "@/lib/jobs/generation-types";
import type { JobStatus } from "@/lib/jobs/job-runner";
import { sanitizeFilename } from "@/lib/print/filenames";
import { presetKeyToPixels } from "@/lib/print/math";
import {
  getAutomaticPrintRatioKeys,
  getPrintRatioPreset,
  getPrintRatioOrientation,
  isPrintRatioPresetKey,
  type PrintRatioPresetKey
} from "@/lib/print/presets";
import { buildWallArtPrompt } from "@/lib/prompts/builder";
import { promptInputSchema, type PromptInput } from "@/lib/prompts/schema";
import {
  createOptionalSignedDownloadUrl,
  getStorageProvider
} from "@/lib/storage";

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
  creditRefunded: boolean;
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
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  attemptCount: number;
};

type LocalGenerationState = {
  jobs: Map<string, LocalGenerationJob>;
  ledger: InMemoryCreditLedger;
};

type GeneratedArtworkRatioSource = {
  ratioKey: PrintRatioPresetKey;
  image: GeneratedImage;
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
const DEFAULT_GENERATION_JOB_TIMEOUT_MS = 25 * 60 * 1000;
const DIMENSION_PREVIEW_LONG_EDGE_PX = 1400;
const DIMENSION_PREVIEW_BACKGROUND = "#ffffff";
const DIMENSION_PREVIEW_BLUR_SIGMA = 20;
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
    creditCost:
      input.creditCost ?? generationCreditCostForPreviewCount(previewCount),
    creditReserved: false,
    creditCommitted: false,
    creditRefunded: false,
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
  await persistGenerationJob(job);
  await persistProjectGenerating(job);

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
  const job = shouldPreferFirestoreJobClaim()
    ? undefined
    : state.jobs.get(jobId);

  if (job?.userId === userId) {
    await failTimedOutLocalGenerationJob(job, { now: new Date() });
    return toGenerationJobView(job);
  }

  const persistedJob = await getFirestoreGenerationJobForUser(jobId, userId);

  if (!persistedJob) {
    return null;
  }

  return expireStalePersistedGenerationJob(persistedJob, userId);
}

export async function cancelLocalGenerationJob(jobId: string, userId: string) {
  const job = shouldPreferFirestoreJobClaim()
    ? undefined
    : state.jobs.get(jobId);

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

    if (
      persistedJob.status !== "queued" &&
      persistedJob.status !== "validating"
    ) {
      return cannotCancelResult(persistedJob.status);
    }

    let cancelledJob: GenerationJobView = {
      ...persistedJob,
      status: "cancelled",
      stage: "cancelled",
      retryable: true,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (
      cancelledJob.creditReserved &&
      !cancelledJob.creditCommitted &&
      !cancelledJob.creditRefunded
    ) {
      await refundLocalCredits({
        userId,
        amount: cancelledJob.creditCost,
        reason: "Preview generation cancelled",
        idempotencyKey: `${cancelledJob.jobId}:cancel-refund`,
        relatedJobId: cancelledJob.jobId
      });
      cancelledJob = { ...cancelledJob, creditRefunded: true };
    }

    await saveFirestoreGenerationJob(cancelledJob, { userId });
    await markFirestoreProjectStatus({
      projectId: cancelledJob.projectId,
      userId,
      status: "draft"
    });

    return { ok: true as const, job: cancelledJob };
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
    await refundLocalCredits({
      userId: job.userId,
      amount: job.creditCost,
      reason: "Preview generation cancelled",
      idempotencyKey: `${job.id}:cancel-refund`,
      relatedJobId: job.id
    });
    job.creditRefunded = true;
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
  if (shouldPreferFirestoreJobClaim()) {
    return null;
  }

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

async function claimGenerationJob(
  jobId: string,
  options: { leaseOwner: string }
): Promise<LocalGenerationJob | null> {
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
    localJob.leaseExpiresAt = new Date(
      now.getTime() + getGenerationJobTimeoutMs()
    );
    localJob.attemptCount += 1;
    await persistGenerationJob(localJob);

    return localJob;
  }

  const record = await claimFirestoreGenerationJob(jobId, {
    leaseOwner: options.leaseOwner,
    leaseMs: getGenerationJobTimeoutMs(),
    now
  });

  if (!record) {
    return null;
  }

  return localGenerationJobFromView(record.job, record.userId);
}

function shouldPreferFirestoreJobClaim() {
  return (
    process.env.NODE_ENV !== "test" && process.env.JOB_RUNNER === "cloud-tasks"
  );
}

export async function processGenerationJob(
  jobId: string,
  options: { leaseOwner?: string } = {}
) {
  const job = await claimGenerationJob(jobId, {
    leaseOwner: options.leaseOwner ?? `worker_${randomUUID()}`
  });

  if (!job) {
    return { processed: false as const, job: null };
  }

  try {
    if (isGenerationJobCancelled(job)) {
      return { processed: false as const, job: toGenerationJobView(job) };
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
      return { processed: false as const, job: toGenerationJobView(job) };
    }

    job.status = "running";
    job.stage = "provider_generation";
    await persistGenerationJob(job);

    const artworkSources = await generateArtworkRatioSources({
      prompt: job.prompt,
      negativePrompt: job.negativePrompt,
      count: job.requestedCount,
      primaryRatio: job.primaryRatio
    });

    job.status = "processing";
    job.stage = "preview_packaging";
    await persistGenerationJob(job);
    job.status = "uploading";
    job.stage = "storage_upload";
    await persistGenerationJob(job);
    job.artworks = await Promise.all(
      artworkSources.map((ratioSources) =>
        toArtworkPreview(ratioSources, {
          userId: job.userId,
          projectId: job.projectId,
          jobId: job.id,
          primaryRatio: job.primaryRatio
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
    return { processed: true as const, job: toGenerationJobView(job) };
  } catch (error) {
    if (job.creditReserved && !job.creditCommitted) {
      await refundLocalCredits({
        userId: job.userId,
        amount: job.creditCost,
        reason: "Preview generation failed",
        idempotencyKey: `${job.id}:refund`,
        relatedJobId: job.id
      });
      job.creditRefunded = true;
    }

    job.status = "failed";
    job.stage = "failed";
    const failure = generationFailureFromError(error);
    job.errorCode = failure.code;
    job.errorMessage = failure.message;
    job.retryable = failure.retryable;
    job.completedAt = new Date();
    await persistGenerationJob(job).catch(() => undefined);
    await persistProjectGenerated(job, "failed").catch(() => undefined);
    return { processed: true as const, job: toGenerationJobView(job) };
  }
}

function generationFailureFromError(error: unknown) {
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
      message: imageProviderInsufficientCreditsMessage("Image generation"),
      retryable: true
    };
  }

  return {
    code: "GENERATION_FAILED",
    message:
      error instanceof Error
        ? error.message
        : "Generation failed unexpectedly.",
    retryable: true
  };
}

export async function processLocalGenerationJob(jobId: string) {
  return processGenerationJob(jobId);
}

async function generateArtworkRatioSources(input: {
  prompt: string;
  negativePrompt: string;
  count: number;
  primaryRatio: string;
}): Promise<GeneratedArtworkRatioSource[][]> {
  const imageProvider = getImageProvider();
  const ratioKeys = automaticRatioKeysForPrimaryRatio(input.primaryRatio);
  const primaryRatioKey = primaryRatioKeyForRatioSet(
    input.primaryRatio,
    ratioKeys
  );
  const primaryImages = await imageProvider.generate({
    prompt: promptForPrimaryRatio(input.prompt, primaryRatioKey),
    negativePrompt: input.negativePrompt,
    count: input.count,
    aspectRatio: primaryRatioKey
  });

  if (primaryImages.length < input.count) {
    throw new Error(
      `Image provider returned ${primaryImages.length} of ${input.count} requested artwork variants.`
    );
  }

  return Promise.all(
    primaryImages.slice(0, input.count).map(async (primaryImage) => {
      const ratioSources = await Promise.all(
        ratioKeys.map((ratioKey) => {
          if (ratioKey === primaryRatioKey) {
            return Promise.resolve({
              ratioKey,
              image: primaryImage
            });
          }

          return generateReferencedRatioSource(imageProvider, {
            prompt: input.prompt,
            negativePrompt: input.negativePrompt,
            ratioKey,
            referenceImage: primaryImage
          });
        })
      );

      return ratioSources;
    })
  );
}

async function generateReferencedRatioSource(
  imageProvider: ImageProvider,
  input: {
    prompt: string;
    negativePrompt: string;
    ratioKey: PrintRatioPresetKey;
    referenceImage: GeneratedImage;
  }
): Promise<GeneratedArtworkRatioSource> {
  const [image] = await imageProvider.generate({
    prompt: promptForReferencedRatio(input.prompt, input.ratioKey),
    negativePrompt: input.negativePrompt,
    count: 1,
    aspectRatio: input.ratioKey,
    referenceImages: [generatedImageToDataUri(input.referenceImage)]
  });

  if (!image) {
    throw new Error(`Image provider did not return ${input.ratioKey} artwork.`);
  }

  return {
    ratioKey: input.ratioKey,
    image
  };
}

function primaryRatioKeyForRatioSet(
  primaryRatio: string,
  ratioKeys: PrintRatioPresetKey[]
) {
  return isPrintRatioPresetKey(primaryRatio) && ratioKeys.includes(primaryRatio)
    ? primaryRatio
    : ratioKeys[0];
}

function promptForPrimaryRatio(prompt: string, ratioKey: PrintRatioPresetKey) {
  const ratio = getPrintRatioPreset(ratioKey);

  return [
    prompt,
    "",
    `Create the master artwork for this Etsy pack in ${ratio.label}. The other included ratios will use this image as the visual reference.`
  ].join("\n");
}

function promptForReferencedRatio(
  prompt: string,
  ratioKey: PrintRatioPresetKey
) {
  const ratio = getPrintRatioPreset(ratioKey);

  return [
    prompt,
    "",
    `Create the same artwork as the reference image in ${ratio.label}.`,
    "Preserve the same subject, style, palette, lighting, texture, visual identity, and overall composition from the reference image.",
    "Only extend or reframe the canvas as needed for the new print ratio. Do not introduce a new artwork variant."
  ].join("\n");
}

function generatedImageToDataUri(image: GeneratedImage) {
  return `data:${image.mimeType};base64,${Buffer.from(image.bytes).toString(
    "base64"
  )}`;
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
  ratioSources: GeneratedArtworkRatioSource[],
  input: {
    userId: string;
    projectId: string;
    jobId: string;
    primaryRatio: string;
  }
): Promise<GeneratedArtworkPreview> {
  const artworkId = `art_${randomUUID()}`;
  const primaryRatioKey = isPrintRatioPresetKey(input.primaryRatio)
    ? input.primaryRatio
    : ratioSources[0]?.ratioKey;
  const primaryRatioSource =
    ratioSources.find((source) => source.ratioKey === primaryRatioKey) ??
    ratioSources[0];

  if (!primaryRatioSource) {
    throw new Error("Image provider did not return artwork sources.");
  }

  const dimensionPreviews = await createArtworkDimensionPreviews(ratioSources, {
    artworkId,
    userId: input.userId,
    projectId: input.projectId,
    jobId: input.jobId
  });
  const primaryDimensionPreview =
    dimensionPreviews.find(
      (preview) => preview.ratioKey === primaryRatioSource.ratioKey
    ) ?? dimensionPreviews[0];
  const primarySourceStoragePath =
    primaryDimensionPreview?.sourceStoragePath ??
    sourceStoragePathFor({
      userId: input.userId,
      projectId: input.projectId,
      artworkId,
      ratioKey: primaryRatioSource.ratioKey,
      extension: extensionFromMimeType(primaryRatioSource.image.mimeType)
    });

  if (process.env.NODE_ENV !== "test") {
    const signedUrl = await createOptionalSignedDownloadUrl(
      primarySourceStoragePath
    );

    return {
      artworkId,
      dataUrl:
        signedUrl === null
          ? (primaryDimensionPreview?.dataUrl ??
            `data:${primaryRatioSource.image.mimeType};base64,${Buffer.from(
              primaryRatioSource.image.bytes
            ).toString("base64")}`)
          : undefined,
      previewUrl: signedUrl?.url,
      previewUrlExpiresAt: signedUrl?.expiresAt.toISOString(),
      width: primaryRatioSource.image.width,
      height: primaryRatioSource.image.height,
      mimeType: primaryRatioSource.image.mimeType,
      providerRequestId: primaryRatioSource.image.providerRequestId,
      sourceStoragePath: primarySourceStoragePath,
      previewStoragePath: primarySourceStoragePath,
      dimensionPreviews,
      createdAt: new Date().toISOString()
    };
  }

  return {
    artworkId,
    dataUrl:
      primaryDimensionPreview?.sourceDataUrl ??
      `data:${primaryRatioSource.image.mimeType};base64,${Buffer.from(
        primaryRatioSource.image.bytes
      ).toString("base64")}`,
    width: primaryRatioSource.image.width,
    height: primaryRatioSource.image.height,
    mimeType: primaryRatioSource.image.mimeType,
    providerRequestId: primaryRatioSource.image.providerRequestId,
    sourceStoragePath: primarySourceStoragePath,
    previewStoragePath: primarySourceStoragePath,
    dimensionPreviews,
    createdAt: new Date().toISOString()
  };
}

async function createArtworkDimensionPreviews(
  ratioSources: GeneratedArtworkRatioSource[],
  input: {
    artworkId: string;
    userId: string;
    projectId: string;
    jobId: string;
  }
): Promise<GeneratedArtworkDimensionPreview[]> {
  return Promise.all(
    ratioSources.map((source) =>
      createArtworkDimensionPreview(source.image, {
        ...input,
        ratioKey: source.ratioKey
      })
    )
  );
}

async function createArtworkDimensionPreview(
  image: GeneratedImage,
  input: {
    artworkId: string;
    userId: string;
    projectId: string;
    jobId: string;
    ratioKey: PrintRatioPresetKey;
  }
): Promise<GeneratedArtworkDimensionPreview> {
  const printPixels = presetKeyToPixels(input.ratioKey);
  const previewPixels = scalePreviewPixels(printPixels);
  const sourceStoragePath = sourceStoragePathFor({
    userId: input.userId,
    projectId: input.projectId,
    artworkId: input.artworkId,
    ratioKey: input.ratioKey,
    extension: extensionFromMimeType(image.mimeType)
  });
  const previewBytes = await renderDimensionPreview({
    sourceBytes: Buffer.from(image.bytes),
    sourceWidth: image.width,
    sourceHeight: image.height,
    targetWidth: previewPixels.width,
    targetHeight: previewPixels.height
  });
  const createdAt = new Date().toISOString();
  const previewStoragePath = [
    "previews",
    safeStorageSegment(input.userId),
    safeStorageSegment(input.projectId),
    safeStorageSegment(input.artworkId),
    `${safeStorageSegment(input.ratioKey)}.jpg`
  ].join("/");

  if (process.env.NODE_ENV !== "test") {
    await getStorageProvider().uploadObject({
      path: sourceStoragePath,
      bytes: image.bytes,
      contentType: image.mimeType,
      metadata: {
        projectId: input.projectId,
        generationJobId: input.jobId,
        artworkId: input.artworkId,
        ratioKey: input.ratioKey,
        providerRequestId: image.providerRequestId ?? ""
      }
    });
    await getStorageProvider().uploadObject({
      path: previewStoragePath,
      bytes: previewBytes,
      contentType: "image/jpeg",
      metadata: {
        projectId: input.projectId,
        generationJobId: input.jobId,
        artworkId: input.artworkId,
        ratioKey: input.ratioKey
      }
    });
    const signedUrl = await createOptionalSignedDownloadUrl(previewStoragePath);

    return {
      ratioKey: input.ratioKey,
      dataUrl:
        signedUrl === null
          ? `data:image/jpeg;base64,${previewBytes.toString("base64")}`
          : undefined,
      sourceDataUrl:
        signedUrl === null
          ? `data:${image.mimeType};base64,${Buffer.from(image.bytes).toString(
              "base64"
            )}`
          : undefined,
      previewUrl: signedUrl?.url,
      previewUrlExpiresAt: signedUrl?.expiresAt.toISOString(),
      sourceStoragePath,
      sourceWidth: image.width,
      sourceHeight: image.height,
      sourceMimeType: image.mimeType,
      sourceProviderRequestId: image.providerRequestId,
      printWidth: printPixels.width,
      printHeight: printPixels.height,
      previewWidth: previewPixels.width,
      previewHeight: previewPixels.height,
      previewStoragePath,
      createdAt
    };
  }

  return {
    ratioKey: input.ratioKey,
    dataUrl: `data:image/jpeg;base64,${previewBytes.toString("base64")}`,
    sourceDataUrl: `data:${image.mimeType};base64,${Buffer.from(
      image.bytes
    ).toString("base64")}`,
    sourceStoragePath,
    sourceWidth: image.width,
    sourceHeight: image.height,
    sourceMimeType: image.mimeType,
    sourceProviderRequestId: image.providerRequestId,
    printWidth: printPixels.width,
    printHeight: printPixels.height,
    previewWidth: previewPixels.width,
    previewHeight: previewPixels.height,
    previewStoragePath,
    createdAt
  };
}

async function renderDimensionPreview(input: {
  sourceBytes: Buffer;
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
}) {
  const targetPixels = {
    width: input.targetWidth,
    height: input.targetHeight
  };
  const frame = fitImageWithinCanvas(
    { width: input.sourceWidth, height: input.sourceHeight },
    targetPixels
  );
  const foreground = await sharp(input.sourceBytes)
    .rotate()
    .resize({
      width: frame.width,
      height: frame.height,
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false
    })
    .flatten({ background: DIMENSION_PREVIEW_BACKGROUND })
    .toColorspace("srgb")
    .toBuffer();
  const background = await sharp(input.sourceBytes)
    .rotate()
    .resize({
      width: targetPixels.width,
      height: targetPixels.height,
      fit: "cover",
      position: "center",
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false
    })
    .flatten({ background: DIMENSION_PREVIEW_BACKGROUND })
    .blur(DIMENSION_PREVIEW_BLUR_SIGMA)
    .modulate({ brightness: 1.04, saturation: 1.08 })
    .toColorspace("srgb")
    .toBuffer();

  return sharp(background)
    .composite([{ input: foreground, left: frame.left, top: frame.top }])
    .jpeg({
      quality: 82,
      progressive: true,
      mozjpeg: true
    })
    .toBuffer();
}

function scalePreviewPixels(printPixels: { width: number; height: number }) {
  const longEdge = Math.max(printPixels.width, printPixels.height);
  const scale = DIMENSION_PREVIEW_LONG_EDGE_PX / longEdge;

  return {
    width: Math.max(1, Math.round(printPixels.width * scale)),
    height: Math.max(1, Math.round(printPixels.height * scale))
  };
}

function automaticRatioKeysForPrimaryRatio(primaryRatio: string) {
  const ratioKey = isPrintRatioPresetKey(primaryRatio) ? primaryRatio : "2x3";

  return getAutomaticPrintRatioKeys(getPrintRatioOrientation(ratioKey));
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
    creditRefunded: job.creditRefunded,
    prompt: job.prompt,
    negativePrompt: job.negativePrompt,
    primaryRatio: job.primaryRatio,
    quality: job.quality,
    retryable: job.retryable,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    artworks: job.artworks,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    leaseOwner: job.leaseOwner,
    leaseExpiresAt: job.leaseExpiresAt?.toISOString() ?? null,
    attemptCount: job.attemptCount
  };
}

function localGenerationJobFromView(
  job: GenerationJobView,
  userId: string
): LocalGenerationJob {
  const provider =
    process.env.IMAGE_PROVIDER === "runware" ? "runware" : "mock";

  return {
    id: job.jobId,
    userId,
    projectId: job.projectId,
    projectName: job.projectName,
    status: job.status,
    stage: job.stage,
    requestedCount: job.requestedCount,
    creditCost: job.creditCost,
    creditReserved: job.creditReserved,
    creditCommitted: job.creditCommitted,
    creditRefunded: job.creditRefunded,
    prompt: job.prompt,
    negativePrompt: job.negativePrompt,
    primaryRatio: job.primaryRatio,
    quality: job.quality,
    provider,
    model:
      provider === "runware"
        ? (process.env.RUNWARE_AIR_ID ?? RUNWARE_GPT_IMAGE_AIR_ID)
        : "mock-wall-art-preview",
    retryable: job.retryable,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    artworks: job.artworks,
    createdAt: dateFromIso(job.createdAt),
    updatedAt: dateFromIso(job.updatedAt),
    startedAt: nullableDateFromIso(job.startedAt),
    completedAt: nullableDateFromIso(job.completedAt),
    leaseOwner: job.leaseOwner,
    leaseExpiresAt: nullableDateFromIso(job.leaseExpiresAt),
    attemptCount: job.attemptCount
  };
}

function clampPreviewCount(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(4, Math.trunc(value)));
}

export function isStaleGenerationJobView(
  job: Pick<
    GenerationJobView,
    "createdAt" | "startedAt" | "status" | "updatedAt"
  >,
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
  const timeoutMs = options.timeoutMs ?? getGenerationJobTimeoutMs();

  return now.getTime() - lastActivityAt >= timeoutMs;
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getGenerationJobTimeoutMs() {
  return readPositiveIntegerEnv(
    "GENERATION_JOB_TIMEOUT_MS",
    DEFAULT_GENERATION_JOB_TIMEOUT_MS
  );
}

async function persistGenerationJob(job: LocalGenerationJob) {
  job.updatedAt = new Date();
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

async function expireStalePersistedGenerationJob(
  job: GenerationJobView,
  userId: string
) {
  if (!isStaleGenerationJobView(job)) {
    return job;
  }

  let timedOutJob = timedOutGenerationJobView(job, new Date());

  if (
    timedOutJob.creditReserved &&
    !timedOutJob.creditCommitted &&
    !timedOutJob.creditRefunded
  ) {
    await refundLocalCredits({
      userId,
      amount: timedOutJob.creditCost,
      reason: "Preview generation timed out",
      idempotencyKey: `${timedOutJob.jobId}:refund`,
      relatedJobId: timedOutJob.jobId
    });
    timedOutJob = {
      ...timedOutJob,
      creditRefunded: true
    };
  }

  await saveFirestoreGenerationJob(timedOutJob, { userId });
  await markFirestoreProjectStatus({
    projectId: timedOutJob.projectId,
    userId,
    status: "failed"
  });

  return timedOutJob;
}

async function failTimedOutLocalGenerationJob(
  job: LocalGenerationJob,
  options: { now: Date }
) {
  if (!isStaleGenerationJobView(toGenerationJobView(job), options)) {
    return false;
  }

  job.status = "failed";
  job.stage = "timed_out";
  job.errorCode = "GENERATION_TIMEOUT";
  job.errorMessage =
    "Generation job timed out before it finished. Any reserved credits were refunded. Please retry the generation.";
  job.retryable = true;
  job.completedAt = options.now;

  if (job.creditReserved && !job.creditCommitted && !job.creditRefunded) {
    await refundLocalCredits({
      userId: job.userId,
      amount: job.creditCost,
      reason: "Preview generation timed out",
      idempotencyKey: `${job.id}:refund`,
      relatedJobId: job.id
    });
    job.creditRefunded = true;
  }

  await persistGenerationJob(job);
  await persistProjectGenerated(job, "failed").catch(() => undefined);

  return true;
}

function timedOutGenerationJobView(
  job: GenerationJobView,
  now: Date
): GenerationJobView {
  const timestamp = now.toISOString();

  return {
    ...job,
    status: "failed",
    stage: "timed_out",
    retryable: true,
    errorCode: "GENERATION_TIMEOUT",
    errorMessage:
      "Generation job timed out before it finished. Any reserved credits were refunded. Please retry the generation.",
    updatedAt: timestamp,
    completedAt: timestamp
  };
}

function timestampFromIso(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? null : timestamp;
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

function sourceStoragePathFor(input: {
  userId: string;
  projectId: string;
  artworkId: string;
  ratioKey: PrintRatioPresetKey;
  extension: string;
}) {
  return [
    "sources",
    safeStorageSegment(input.userId),
    safeStorageSegment(input.projectId),
    safeStorageSegment(input.artworkId),
    safeStorageSegment(input.ratioKey),
    `source.${input.extension}`
  ].join("/");
}

function safeStorageSegment(value: string) {
  return sanitizeFilename(value, "wallpack").replaceAll(".", "-");
}
