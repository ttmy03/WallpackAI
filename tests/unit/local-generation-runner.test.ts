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

    const job = await waitForLocalGenerationJob(queued.jobId);

    expect(job.status).toBe("succeeded");
    expect(job.creditReserved).toBe(true);
    expect(job.creditCommitted).toBe(true);
    expect(job.artworks).toHaveLength(2);
    expect(job.artworks[0]?.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(getLocalCreditBalance(userId)).toBe(beforeBalance - 10);
  });

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

    const job = await waitForLocalGenerationJob(queued.jobId);

    expect(job.status).toBe("succeeded");
    expect(job.primaryRatio).toBe("3x2");
    expect(job.artworks[0]?.width).toBeGreaterThan(
      job.artworks[0]?.height ?? 0
    );
  });

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
