import { describe, expect, it } from "vitest";

import {
  cancelLocalGenerationJob,
  enqueueLocalGenerationJob,
  getLocalCreditBalance,
  retryLocalGenerationJob,
  waitForLocalGenerationJob
} from "@/lib/jobs/local-generation-runner";
import type { PromptInput } from "@/lib/prompts/schema";

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

describe("local generation runner", () => {
  it("queues work, debits credits, and completes with preview data URLs", async () => {
    const userId = `seller-${crypto.randomUUID()}`;
    const beforeBalance = getLocalCreditBalance(userId);
    const queued = await enqueueLocalGenerationJob({
      userId,
      projectName: safeInput.packName,
      promptInputs: safeInput,
      previewCount: 2
    });

    expect(queued.status).toBe("queued");

    const job = await waitForLocalGenerationJob(queued.jobId, {
      timeoutMs: 20_000
    });

    expect(job.status).toBe("succeeded");
    expect(job.creditReserved).toBe(true);
    expect(job.creditCommitted).toBe(true);
    expect(job.artworks).toHaveLength(2);
    expect(job.artworks[0]?.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(job.artworks[0]?.dimensionPreviews).toHaveLength(5);
    expect(
      job.artworks[0]?.dimensionPreviews?.map((preview) => preview.ratioKey)
    ).toEqual(["2x3", "3x4", "4x5", "5x7", "11x14"]);
    expect(
      job.artworks[0]?.dimensionPreviews?.map((preview) => ({
        ratioKey: preview.ratioKey,
        sourceWidth: preview.sourceWidth,
        sourceHeight: preview.sourceHeight
      }))
    ).toEqual([
      { ratioKey: "2x3", sourceWidth: 864, sourceHeight: 1296 },
      { ratioKey: "3x4", sourceWidth: 900, sourceHeight: 1200 },
      { ratioKey: "4x5", sourceWidth: 960, sourceHeight: 1200 },
      { ratioKey: "5x7", sourceWidth: 900, sourceHeight: 1260 },
      { ratioKey: "11x14", sourceWidth: 990, sourceHeight: 1260 }
    ]);
    expect(
      job.artworks[0]?.dimensionPreviews?.every((preview) =>
        preview.sourceDataUrl?.startsWith("data:image/png;base64,")
      )
    ).toBe(true);
    expect(job.artworks[0]?.dimensionPreviews?.[0]).toMatchObject({
      ratioKey: "2x3",
      printWidth: 7200,
      printHeight: 10800,
      previewWidth: 933,
      previewHeight: 1400
    });
    expect(job.artworks[0]?.dimensionPreviews?.[0]?.dataUrl).toMatch(
      /^data:image\/jpeg;base64,/
    );
    expect(getLocalCreditBalance(userId)).toBe(beforeBalance - 10);
  }, 20_000);

  it("passes landscape primary ratios through to preview generation", async () => {
    const userId = `seller-${crypto.randomUUID()}`;
    const queued = await enqueueLocalGenerationJob({
      userId,
      projectName: safeInput.packName,
      promptInputs: {
        ...safeInput,
        primaryRatio: "3x2"
      },
      previewCount: 1
    });

    const job = await waitForLocalGenerationJob(queued.jobId, {
      timeoutMs: 20_000
    });

    expect(job.status).toBe("succeeded");
    expect(job.primaryRatio).toBe("3x2");
    expect(job.artworks[0]?.width).toBeGreaterThan(
      job.artworks[0]?.height ?? 0
    );
    expect(
      job.artworks[0]?.dimensionPreviews?.map((preview) => preview.ratioKey)
    ).toEqual(["3x2", "4x3", "5x4", "7x5", "14x11"]);
    expect(job.artworks[0]?.dimensionPreviews?.[1]).toMatchObject({
      ratioKey: "4x3",
      sourceWidth: 1200,
      sourceHeight: 900
    });
  }, 20_000);

  it("blocks protected prompts before queueing provider work", async () => {
    await expect(
      enqueueLocalGenerationJob({
        userId: `seller-${crypto.randomUUID()}`,
        promptInputs: {
          ...safeInput,
          subject: "Disney princess nursery poster"
        },
        previewCount: 1
      })
    ).rejects.toThrow(/protected brand/i);
  });

  it("cancels queued local generation jobs before provider work starts", async () => {
    const userId = `seller-${crypto.randomUUID()}`;
    const queued = await enqueueLocalGenerationJob({
      userId,
      projectName: safeInput.packName,
      promptInputs: safeInput,
      previewCount: 1
    });

    const cancelled = await cancelLocalGenerationJob(queued.jobId, userId);

    expect(cancelled.ok).toBe(true);
    expect(cancelled.ok ? cancelled.job.status : null).toBe("cancelled");
  });

  it("rejects retry for jobs that are not failed and retryable", async () => {
    const userId = `seller-${crypto.randomUUID()}`;
    const queued = await enqueueLocalGenerationJob({
      userId,
      projectName: safeInput.packName,
      promptInputs: safeInput,
      previewCount: 1
    });
    await cancelLocalGenerationJob(queued.jobId, userId);

    const retry = await retryLocalGenerationJob(queued.jobId, userId);

    expect(retry.ok).toBe(false);
    expect(retry.ok ? null : retry.code).toBe("RETRY_NOT_ALLOWED");
  });
});
