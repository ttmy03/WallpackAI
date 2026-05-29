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
    vi.doUnmock("@/lib/ai");
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

  it("hides provider wallet errors and refunds reserved credits", async () => {
    process.env.JOB_RUNNER = "local";
    vi.doMock("@/lib/ai", () => ({
      getImageProvider: () => ({
        generate: vi.fn(async () => {
          throw new Error(
            "Runware image request failed with HTTP 400: Insufficient credits, please add your credit card and top-up your balance at https://my.runware.ai/wallet"
          );
        })
      })
    }));

    const generation = await import("@/lib/jobs/local-generation-runner");
    const userId = "seller_provider_wallet_failure";
    const beforeBalance = generation.getLocalCreditBalance(userId);
    const queued = await generation.enqueueLocalGenerationJob({
      userId,
      projectId: "prj_provider_wallet_failure",
      projectName: safeInput.packName,
      promptInputs: safeInput,
      previewCount: 1
    });

    await generation.processGenerationJob(queued.jobId);

    const job = await generation.waitForLocalGenerationJob(queued.jobId);

    expect(job.status).toBe("failed");
    expect(job.errorCode).toBe("IMAGE_PROVIDER_INSUFFICIENT_CREDITS");
    expect(job.errorMessage).toContain("connected AI provider");
    expect(job.errorMessage).not.toContain("my.runware.ai");
    expect(job.retryable).toBe(true);
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
