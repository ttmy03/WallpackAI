import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FirestoreProject } from "@/lib/firestore/projects";
import type { PromptInput } from "@/lib/prompts/schema";

const mocks = vi.hoisted(() => {
  const uploads = new Map<
    string,
    { bytes: Buffer; contentType: string; metadata?: Record<string, string> }
  >();
  const storageProvider = {
    uploadObject: vi.fn(
      async (input: {
        path: string;
        bytes: Buffer | Uint8Array;
        contentType: string;
        metadata?: Record<string, string>;
      }) => {
        const bytes = Buffer.from(input.bytes);

        uploads.set(input.path, {
          bytes,
          contentType: input.contentType,
          metadata: input.metadata
        });

        return {
          path: input.path,
          bucket: "test-bucket",
          contentType: input.contentType,
          bytes: bytes.byteLength
        };
      }
    ),
    downloadObject: vi.fn(async (path: string) => {
      const object = uploads.get(path);

      if (!object) {
        throw new Error(`Missing stored object: ${path}`);
      }

      return {
        path,
        bytes: object.bytes,
        contentType: object.contentType
      };
    }),
    listObjects: vi.fn(async (prefix: string) =>
      [...uploads.entries()]
        .filter(([path]) => path.startsWith(prefix))
        .map(([path, object]) => ({
          path,
          bucket: "test-bucket",
          contentType: object.contentType,
          bytes: object.bytes.byteLength
        }))
    ),
    createSignedDownloadUrl: vi.fn(async (path: string) => ({
      url: `https://signed.example/${encodeURIComponent(path)}`,
      expiresAt: new Date("2026-05-29T12:00:00.000Z")
    })),
    deleteObject: vi.fn(async (path: string) => {
      uploads.delete(path);
    })
  };

  return {
    getFirestoreProjectForUser: vi.fn(),
    markFirestoreProjectGenerating: vi.fn(),
    markFirestoreProjectStatus: vi.fn(),
    storageProvider,
    uploads
  };
});

vi.mock("@/lib/firestore/projects", () => ({
  getFirestoreProjectForUser: mocks.getFirestoreProjectForUser,
  markFirestoreProjectGenerating: mocks.markFirestoreProjectGenerating,
  markFirestoreProjectStatus: mocks.markFirestoreProjectStatus
}));

vi.mock("@/lib/storage", () => ({
  getStorageProvider: () => mocks.storageProvider,
  createOptionalSignedDownloadUrl: mocks.storageProvider.createSignedDownloadUrl,
  createOptionalStorageDataUrl: vi.fn(async () => null)
}));

const originalEnv = {
  imageProvider: process.env.IMAGE_PROVIDER,
  jobRunner: process.env.JOB_RUNNER,
  localJobAutoprocess: process.env.LOCAL_JOB_AUTOPROCESS,
  upscaleProvider: process.env.UPSCALE_PROVIDER,
  workerSecret: process.env.JOB_WORKER_SECRET
};

const safeInput: PromptInput = {
  packName: "Mountain calm set",
  subject: "minimalist mountain landscape",
  niche: "neutral printable art",
  room: "living room",
  stylePresetKey: "japandi_minimal",
  paletteKey: "warm_neutral_sage",
  mood: "calm and serene",
  composition: "centered with large negative space",
  avoid: ["text", "logos", "watermarks"],
  primaryRatio: "2x3"
};

describe("job workers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uploads.clear();
    process.env.IMAGE_PROVIDER = "mock";
    process.env.JOB_RUNNER = "local";
    process.env.LOCAL_JOB_AUTOPROCESS = "false";
    process.env.UPSCALE_PROVIDER = "mock";
    process.env.JOB_WORKER_SECRET = "worker-secret";
    mocks.getFirestoreProjectForUser.mockImplementation(
      async (userId: string, projectId: string) =>
        projectId === "prj_worker" ? projectFor(userId) : null
    );
  });

  afterEach(() => {
    restoreEnv("IMAGE_PROVIDER", originalEnv.imageProvider);
    restoreEnv("JOB_RUNNER", originalEnv.jobRunner);
    restoreEnv("LOCAL_JOB_AUTOPROCESS", originalEnv.localJobAutoprocess);
    restoreEnv("UPSCALE_PROVIDER", originalEnv.upscaleProvider);
    restoreEnv("JOB_WORKER_SECRET", originalEnv.workerSecret);
  });

  it("worker processes a queued generation job", async () => {
    const { enqueueLocalGenerationJob, waitForLocalGenerationJob } =
      await import("@/lib/jobs/local-generation-runner");
    const route = await import(
      "@/app/api/internal/jobs/generation/[jobId]/route"
    );
    const queued = await enqueueLocalGenerationJob({
      userId: "seller_worker",
      projectId: "prj_worker",
      projectName: safeInput.packName,
      promptInputs: safeInput,
      previewCount: 1
    });

    const response = await route.POST(workerRequest(), {
      params: Promise.resolve({ jobId: queued.jobId })
    });
    const job = await waitForLocalGenerationJob(queued.jobId, {
      timeoutMs: 20_000
    });

    expect(response.status).toBe(200);
    expect(job.status).toBe("succeeded");
    expect(job.artworks).toHaveLength(1);
  }, 20_000);

  it("worker processes a queued export job", async () => {
    const generation = await import("@/lib/jobs/local-generation-runner");
    const exportJobs = await import("@/lib/jobs/local-export-runner");
    const route = await import("@/app/api/internal/jobs/export/[jobId]/route");
    const queuedGeneration = await generation.enqueueLocalGenerationJob({
      userId: "seller_worker",
      projectId: "prj_worker",
      projectName: safeInput.packName,
      promptInputs: safeInput,
      previewCount: 1
    });
    await generation.processGenerationJob(queuedGeneration.jobId);
    const generationJob = await generation.waitForLocalGenerationJob(
      queuedGeneration.jobId,
      { timeoutMs: 20_000 }
    );
    const artworkId = generationJob.artworks[0]?.artworkId;

    expect(artworkId).toBeTruthy();

    const queuedExport = await exportJobs.enqueueLocalExportJob({
      userId: "seller_worker",
      projectId: "prj_worker",
      artworkId: artworkId ?? "",
      ratioKeys: ["11x14"]
    });

    expect(queuedExport.ok).toBe(true);

    if (!queuedExport.ok) {
      return;
    }

    const response = await route.POST(workerRequest(), {
      params: Promise.resolve({ jobId: queuedExport.job.jobId })
    });
    const job = await exportJobs.waitForLocalExportJob(
      queuedExport.job.jobId,
      { timeoutMs: 30_000 }
    );

    expect(response.status).toBe(200);
    expect(job.status).toBe("succeeded");
    expect(job.artifacts.length).toBeGreaterThan(0);
    expect(job.artifacts).toHaveLength(1);
    expect(job.artifacts.every((artifact) => artifact.bytes < 20 * 1024 * 1024))
      .toBe(true);
    expect(job.externalDeliveryNotRecommended).toBe(false);
  }, 40_000);

  it("retry creates a fresh export job and keeps the failed job unchanged", async () => {
    const generation = await import("@/lib/jobs/local-generation-runner");
    const exportJobs = await import("@/lib/jobs/local-export-runner");
    const { retryExportJob } = await import("@/lib/jobs/job-actions");
    const userId = "seller_retry";
    const beforeBalance = generation.getLocalCreditBalance(userId);
    const queuedGeneration = await generation.enqueueLocalGenerationJob({
      userId,
      projectId: "prj_worker",
      projectName: safeInput.packName,
      promptInputs: safeInput,
      previewCount: 1
    });
    await generation.processGenerationJob(queuedGeneration.jobId);
    const generationJob = await generation.waitForLocalGenerationJob(
      queuedGeneration.jobId,
      { timeoutMs: 20_000 }
    );
    const queuedExport = await exportJobs.enqueueLocalExportJob({
      userId,
      projectId: "prj_worker",
      artworkId: generationJob.artworks[0]?.artworkId ?? "",
      ratioKeys: ["iso-a"]
    });

    expect(queuedExport.ok).toBe(true);

    if (!queuedExport.ok) {
      return;
    }

    await exportJobs.processExportJob(queuedExport.job.jobId);
    const failed = await exportJobs.waitForLocalExportJob(
      queuedExport.job.jobId,
      { timeoutMs: 20_000 }
    );
    const retry = await retryExportJob(failed.jobId, userId);
    const oldJob = await exportJobs.getLocalExportJobForUser(
      failed.jobId,
      userId
    );

    expect(failed.status).toBe("failed");
    expect(failed.retryable).toBe(true);
    expect(failed.creditReserved).toBe(true);
    expect(failed.creditRefunded).toBe(true);
    expect(generation.getLocalCreditBalance(userId)).toBe(beforeBalance - 5);
    expect(retry.ok).toBe(true);

    if (!retry.ok) {
      return;
    }

    expect(retry.job.jobId).not.toBe(failed.jobId);
    expect(retry.job.status).toBe("queued");
    expect(oldJob?.status).toBe("failed");
  }, 30_000);

  it("worker endpoint rejects invalid secrets", async () => {
    const route = await import(
      "@/app/api/internal/jobs/generation/[jobId]/route"
    );
    const response = await route.POST(
      new Request("http://localhost/api/internal/jobs/generation/gen_1", {
        method: "POST",
        headers: { "x-wallpack-job-secret": "wrong-secret" }
      }),
      { params: Promise.resolve({ jobId: "gen_1" }) }
    );

    expect(response.status).toBe(401);
  });

  it("worker endpoint accepts secrets with surrounding whitespace", async () => {
    process.env.JOB_WORKER_SECRET = "worker-secret\n";
    const route = await import(
      "@/app/api/internal/jobs/generation/[jobId]/route"
    );
    const response = await route.POST(workerRequest(), {
      params: Promise.resolve({ jobId: "gen_missing" })
    });

    expect(response.status).toBe(200);
  });
});

function workerRequest() {
  return new Request("http://localhost/api/internal/jobs", {
    method: "POST",
    headers: { "x-wallpack-job-secret": "worker-secret" }
  });
}

function projectFor(userId: string): FirestoreProject {
  return {
    id: "prj_worker",
    userId,
    name: safeInput.packName ?? "Mountain calm set",
    status: "ready",
    niche: safeInput.niche ?? null,
    theme: safeInput.subject,
    stylePresetKey: safeInput.stylePresetKey,
    paletteKey: safeInput.paletteKey,
    customPalette: safeInput.customPalette ?? null,
    promptInputs: safeInput,
    printRatioKeys: ["2x3", "3x4", "4x5", "5x7", "11x14"],
    latestGenerationJobId: null,
    createdAt: "2026-05-29T10:00:00.000Z",
    updatedAt: "2026-05-29T10:00:00.000Z"
  };
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
