import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { FirestoreProject } from "@/lib/firestore/projects";
import type { GeneratedArtworkPreview } from "@/lib/jobs/generation-types";
import type { PromptInput } from "@/lib/prompts/schema";

const mocks = vi.hoisted(() => {
  const uploads = new Map<
    string,
    { bytes: Buffer; contentType: string; metadata?: Record<string, string> }
  >();
  let failUploads = false;
  const storageProvider = {
    uploadObject: vi.fn(
      async (input: {
        path: string;
        bytes: Buffer | Uint8Array;
        contentType: string;
        metadata?: Record<string, string>;
      }) => {
        if (failUploads) {
          throw new Error("Storage upload failed");
        }

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
      expiresAt: new Date("2026-05-30T12:00:00.000Z")
    })),
    deleteObject: vi.fn(async (path: string) => {
      uploads.delete(path);
    })
  };

  return {
    getFirestoreProjectForUser: vi.fn(),
    listFirestoreArtworksForProject: vi.fn(),
    markFirestoreProjectGenerating: vi.fn(),
    markFirestoreProjectStatus: vi.fn(),
    saveFirestoreGenerationJob: vi.fn(),
    claimFirestoreGenerationJob: vi.fn(),
    getFirestoreGenerationJobForUser: vi.fn(),
    getUpscaleProvider: vi.fn(),
    setFailUploads: (value: boolean) => {
      failUploads = value;
    },
    storageProvider,
    uploads
  };
});

vi.mock("@/lib/firestore/projects", () => ({
  getFirestoreProjectForUser: mocks.getFirestoreProjectForUser,
  markFirestoreProjectGenerating: mocks.markFirestoreProjectGenerating,
  markFirestoreProjectStatus: mocks.markFirestoreProjectStatus
}));

vi.mock("@/lib/firestore/generation-jobs", () => ({
  listFirestoreArtworksForProject: mocks.listFirestoreArtworksForProject,
  claimFirestoreGenerationJob: mocks.claimFirestoreGenerationJob,
  getFirestoreGenerationJobForUser: mocks.getFirestoreGenerationJobForUser,
  saveFirestoreGenerationJob: mocks.saveFirestoreGenerationJob
}));

vi.mock("@/lib/storage", () => ({
  getStorageProvider: () => mocks.storageProvider,
  createOptionalSignedDownloadUrl: mocks.storageProvider.createSignedDownloadUrl,
  createOptionalStorageDataUrl: vi.fn(async () => null)
}));

vi.mock("@/lib/ai/upscale", () => ({
  getUpscaleProvider: mocks.getUpscaleProvider
}));

const originalEnv = {
  imageProvider: process.env.IMAGE_PROVIDER,
  jobRunner: process.env.JOB_RUNNER,
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

describe("local mockup runner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.uploads.clear();
    mocks.setFailUploads(false);
    process.env.IMAGE_PROVIDER = "mock";
    process.env.JOB_RUNNER = "local";
    process.env.JOB_WORKER_SECRET = "worker-secret";
    mocks.getFirestoreProjectForUser.mockImplementation(
      async (userId: string, projectId: string) =>
        projectId === "prj_mockup" ? projectFor(userId) : null
    );
    mocks.listFirestoreArtworksForProject.mockResolvedValue([artworkFor()]);
  });

  afterEach(() => {
    restoreEnv("IMAGE_PROVIDER", originalEnv.imageProvider);
    restoreEnv("JOB_RUNNER", originalEnv.jobRunner);
    restoreEnv("JOB_WORKER_SECRET", originalEnv.workerSecret);
  });

  it("reserves credits, stores five provider mockups, and creates a ZIP", async () => {
    const generation = await import("@/lib/jobs/local-generation-runner");
    const mockups = await import("@/lib/jobs/local-mockup-runner");
    const userId = `seller_mockup_${crypto.randomUUID()}`;
    const beforeBalance = generation.getLocalCreditBalance(userId);
    const queued = await mockups.enqueueLocalMockupJob({
      userId,
      projectId: "prj_mockup",
      artworkId: "art_mockup",
      ratioKey: "2x3"
    });

    expect(queued.ok).toBe(true);

    if (!queued.ok) {
      return;
    }

    await mockups.processMockupJob(queued.job.jobId);

    const job = await mockups.waitForLocalMockupJob(queued.job.jobId, {
      timeoutMs: 20_000
    });

    expect(job.status).toBe("succeeded");
    expect(job.creditReserved).toBe(true);
    expect(job.creditCommitted).toBe(true);
    expect(job.creditRefunded).toBe(false);
    expect(job.images).toHaveLength(5);
    expect(job.artifacts).toHaveLength(1);
    expect(job.artifacts[0]?.kind).toBe("mockup_zip");
    expect(job.images.every((image) => image.contentType === "image/png")).toBe(
      true
    );
    expect(
      [...mocks.uploads.keys()].filter((path) =>
        path.startsWith(`mockups/${userId}/prj_mockup/${job.jobId}/`)
      )
    ).toHaveLength(6);
    expect(generation.getLocalCreditBalance(userId)).toBe(beforeBalance - 5);
    expect(mocks.getUpscaleProvider).not.toHaveBeenCalled();
  }, 20_000);

  it("refunds credits once when storage upload fails", async () => {
    const generation = await import("@/lib/jobs/local-generation-runner");
    const mockups = await import("@/lib/jobs/local-mockup-runner");
    const userId = `seller_mockup_failure_${crypto.randomUUID()}`;
    const beforeBalance = generation.getLocalCreditBalance(userId);
    const queued = await mockups.enqueueLocalMockupJob({
      userId,
      projectId: "prj_mockup",
      artworkId: "art_mockup",
      ratioKey: "2x3"
    });

    expect(queued.ok).toBe(true);

    if (!queued.ok) {
      return;
    }

    mocks.setFailUploads(true);
    await mockups.processMockupJob(queued.job.jobId);
    await mockups.processMockupJob(queued.job.jobId);

    const job = await mockups.waitForLocalMockupJob(queued.job.jobId, {
      timeoutMs: 20_000
    });

    expect(job.status).toBe("failed");
    expect(job.retryable).toBe(true);
    expect(job.creditReserved).toBe(true);
    expect(job.creditCommitted).toBe(false);
    expect(job.creditRefunded).toBe(true);
    expect(generation.getLocalCreditBalance(userId)).toBe(beforeBalance);
  }, 20_000);

  it("worker endpoint processes a queued mockup job", async () => {
    const mockups = await import("@/lib/jobs/local-mockup-runner");
    const route = await import("@/app/api/internal/jobs/mockup/[jobId]/route");
    const queued = await mockups.enqueueLocalMockupJob({
      userId: `seller_mockup_worker_${crypto.randomUUID()}`,
      projectId: "prj_mockup",
      artworkId: "art_mockup",
      ratioKey: "2x3"
    });

    expect(queued.ok).toBe(true);

    if (!queued.ok) {
      return;
    }

    const response = await route.POST(workerRequest(), {
      params: Promise.resolve({ jobId: queued.job.jobId })
    });
    const job = await mockups.waitForLocalMockupJob(queued.job.jobId, {
      timeoutMs: 20_000
    });

    expect(response.status).toBe(200);
    expect(job.status).toBe("succeeded");
    expect(job.images).toHaveLength(5);
    expect(job.artifacts).toHaveLength(1);
  }, 20_000);
});

function projectFor(userId: string): FirestoreProject {
  return {
    id: "prj_mockup",
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
    createdAt: "2026-05-30T10:00:00.000Z",
    updatedAt: "2026-05-30T10:00:00.000Z"
  };
}

function artworkFor(): GeneratedArtworkPreview {
  return {
    artworkId: "art_mockup",
    dataUrl: tinyPngDataUrl(),
    width: 864,
    height: 1296,
    mimeType: "image/png",
    providerRequestId: "mock-source-image",
    sourceStoragePath: "sources/seller/prj_mockup/art_mockup/source.png",
    dimensionPreviews: [
      {
        ratioKey: "2x3",
        sourceDataUrl: tinyPngDataUrl(),
        sourceWidth: 864,
        sourceHeight: 1296,
        sourceMimeType: "image/png",
        sourceProviderRequestId: "mock-source-image",
        printWidth: 7200,
        printHeight: 10800,
        previewWidth: 933,
        previewHeight: 1400,
        previewStoragePath: "previews/seller/prj_mockup/art_mockup/2x3.jpg",
        createdAt: "2026-05-30T10:00:00.000Z"
      }
    ],
    createdAt: "2026-05-30T10:00:00.000Z"
  };
}

function tinyPngDataUrl() {
  return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lwD9WQAAAABJRU5ErkJggg==";
}

function workerRequest() {
  return new Request("http://localhost/api/internal/jobs/mockup/mck_1", {
    method: "POST",
    headers: { "x-wallpack-job-secret": "worker-secret" }
  });
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
