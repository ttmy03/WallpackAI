import { describe, expect, it } from "vitest";

import {
  canQueuePreviewBatch,
  createPlanStatus,
  previewCountForPlan
} from "@/lib/billing/plans";
import type { GenerationJobView } from "@/lib/jobs/generation-types";

const generationJob = (
  status: GenerationJobView["status"]
): Pick<GenerationJobView, "requestedCount" | "status"> => ({
  requestedCount: 2,
  status
});

describe("plan entitlements", () => {
  it("allows 3 free preview batches of 2 previews", () => {
    const plan = createPlanStatus({
      planKey: "free",
      generationJobs: [
        generationJob("succeeded"),
        generationJob("running"),
        generationJob("queued")
      ]
    });

    expect(plan.previewBatches.used).toBe(3);
    expect(plan.previewBatches.remaining).toBe(0);
    expect(plan.previewBatches.previewsPerBatch).toBe(2);
    expect(canQueuePreviewBatch(plan)).toBe(false);
    expect(plan.canExportEtsyPack).toBe(false);
  });

  it("does not count failed or cancelled preview batches against free quota", () => {
    const plan = createPlanStatus({
      planKey: "free",
      generationJobs: [
        generationJob("succeeded"),
        generationJob("failed"),
        generationJob("cancelled")
      ]
    });

    expect(plan.previewBatches.used).toBe(1);
    expect(plan.previewBatches.remaining).toBe(2);
    expect(canQueuePreviewBatch(plan)).toBe(true);
  });

  it("unlocks Etsy pack export for paid plans", () => {
    const plan = createPlanStatus({
      planKey: "starter",
      generationJobs: [
        generationJob("succeeded"),
        generationJob("succeeded"),
        generationJob("succeeded"),
        generationJob("succeeded")
      ]
    });

    expect(plan.previewBatches.limit).toBeNull();
    expect(plan.previewBatches.remaining).toBeNull();
    expect(canQueuePreviewBatch(plan)).toBe(true);
    expect(plan.canExportEtsyPack).toBe(true);
  });

  it("forces free generation batches to 2 previews", () => {
    expect(previewCountForPlan({ requestedCount: 4, planKey: "free" })).toBe(2);
    expect(previewCountForPlan({ requestedCount: 4, planKey: "studio" })).toBe(
      4
    );
  });
});
