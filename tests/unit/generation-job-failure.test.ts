import { afterEach, describe, expect, it, vi } from "vitest";

import type { PromptInput } from "@/lib/prompts/schema";

const originalImageProvider = process.env.IMAGE_PROVIDER;
const originalJobRunner = process.env.JOB_RUNNER;

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

describe("generation job failure handling", () => {
  afterEach(() => {
    restoreEnv("IMAGE_PROVIDER", originalImageProvider);
    restoreEnv("JOB_RUNNER", originalJobRunner);
    vi.resetModules();
  });

  it("refunds reserved credits once on technical provider failure", async () => {
    process.env.IMAGE_PROVIDER = "unsupported-provider";
    process.env.JOB_RUNNER = "local";

    const generation = await import("@/lib/jobs/local-generation-runner");
    const userId = "seller_generation_failure";
    const beforeBalance = generation.getLocalCreditBalance(userId);
    const queued = await generation.enqueueLocalGenerationJob({
      userId,
      projectId: "prj_failure",
      projectName: safeInput.packName,
      promptInputs: safeInput,
      previewCount: 1
    });

    await generation.processGenerationJob(queued.jobId);
    await generation.processGenerationJob(queued.jobId);

    const job = await generation.waitForLocalGenerationJob(queued.jobId);

    expect(job.status).toBe("failed");
    expect(job.retryable).toBe(true);
    expect(job.creditReserved).toBe(true);
    expect(job.creditCommitted).toBe(false);
    expect(job.creditRefunded).toBe(true);
    expect(generation.getLocalCreditBalance(userId)).toBe(beforeBalance);
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
