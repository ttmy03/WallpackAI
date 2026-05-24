import { describe, expect, it } from "vitest";

import {
  enqueueLocalGenerationJob,
  getLocalCreditBalance,
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
    expect(getLocalCreditBalance(userId)).toBe(beforeBalance - 2);
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
});
