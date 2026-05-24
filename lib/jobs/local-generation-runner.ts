import { randomUUID } from "node:crypto";

import { getImageProvider } from "@/lib/ai";
import type { GeneratedImage } from "@/lib/ai/image-provider";
import { RUNWARE_SEEDREAM_AIR_ID } from "@/lib/ai/providers/runware";
import {
  InMemoryCreditLedger,
  InsufficientCreditsError
} from "@/lib/billing/credit-ledger";
import type {
  GeneratedArtworkPreview,
  GenerationJobView,
  GenerationQuality
} from "@/lib/jobs/generation-types";
import type { JobStatus } from "@/lib/jobs/job-runner";
import { buildWallArtPrompt } from "@/lib/prompts/builder";
import { promptInputSchema, type PromptInput } from "@/lib/prompts/schema";

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
    input.projectName ?? parsedPromptInputs.packName ?? "Untitled wall-art pack";
  const provider = process.env.IMAGE_PROVIDER === "runware" ? "runware" : "mock";
  const job: LocalGenerationJob = {
    id: `gen_${randomUUID()}`,
    userId: input.userId,
    projectId,
    projectName,
    status: "queued",
    stage: "queued",
    requestedCount: previewCount,
    creditCost: previewCount,
    creditReserved: false,
    creditCommitted: false,
    prompt: builtPrompt.prompt,
    negativePrompt: builtPrompt.negativePrompt,
    primaryRatio: parsedPromptInputs.primaryRatio,
    quality: input.quality ?? "draft",
    provider,
    model:
      provider === "runware"
        ? process.env.RUNWARE_AIR_ID ?? RUNWARE_SEEDREAM_AIR_ID
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
  setTimeout(() => {
    void processLocalGenerationJob(job.id);
  }, 0);

  return {
    jobId: job.id,
    status: job.status,
    projectId: job.projectId
  };
}

export function getLocalGenerationJobForUser(jobId: string, userId: string) {
  const job = state.jobs.get(jobId);

  if (!job || job.userId !== userId) {
    return null;
  }

  return toGenerationJobView(job);
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

async function processLocalGenerationJob(jobId: string) {
  const job = state.jobs.get(jobId);

  if (!job || job.status !== "queued") {
    return;
  }

  job.status = "validating";
  job.stage = "credit_reservation";
  job.startedAt = new Date();

  try {
    ensureDevCredits(job.userId);
    state.ledger.reserve({
      userId: job.userId,
      amount: job.creditCost,
      reason: "Preview generation",
      idempotencyKey: `${job.id}:reserve`,
      relatedJobId: job.id
    });
    job.creditReserved = true;

    job.status = "running";
    job.stage = "provider_generation";

    const images = await getImageProvider().generate({
      prompt: job.prompt,
      negativePrompt: job.negativePrompt,
      count: job.requestedCount,
      aspectRatio: job.primaryRatio
    });

    job.status = "processing";
    job.stage = "preview_packaging";
    job.artworks = images.map((image, index) =>
      toArtworkPreview(image, {
        index,
        userId: job.userId,
        projectId: job.projectId,
        jobId: job.id
      })
    );

    state.ledger.commit({
      userId: job.userId,
      reason: "Preview generation succeeded",
      idempotencyKey: `${job.id}:commit`,
      relatedJobId: job.id
    });
    job.creditCommitted = true;
    job.status = "succeeded";
    job.stage = "complete";
    job.completedAt = new Date();
  } catch (error) {
    if (job.creditReserved && !job.creditCommitted) {
      state.ledger.refund({
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
      error instanceof Error ? error.message : "Generation failed unexpectedly.";
    job.retryable = !(error instanceof InsufficientCreditsError);
    job.completedAt = new Date();
  }
}

function ensureDevCredits(userId: string) {
  state.ledger.grant({
    userId,
    amount: readPositiveIntegerEnv("LOCAL_GENERATION_DEV_CREDITS", DEFAULT_DEV_CREDITS),
    reason: "Local generation development credits",
    idempotencyKey: `local-generation-dev-grant:${userId}`
  });
}

function toArtworkPreview(
  image: GeneratedImage,
  input: { index: number; userId: string; projectId: string; jobId: string }
): GeneratedArtworkPreview {
  const artworkId = `art_${randomUUID()}`;

  return {
    artworkId,
    dataUrl: `data:${image.mimeType};base64,${Buffer.from(image.bytes).toString(
      "base64"
    )}`,
    width: image.width,
    height: image.height,
    mimeType: image.mimeType,
    providerRequestId: image.providerRequestId,
    sourceStoragePath: [
      "local",
      "sources",
      input.userId,
      input.projectId,
      artworkId,
      `preview-${input.index + 1}-${input.jobId}`
    ].join("/"),
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
