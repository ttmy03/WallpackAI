import { describe, expect, it } from "vitest";

import {
  createPlanStatus,
  ETSY_PACK_EXPORT_CREDIT_COST,
  FREE_PLAN_ONE_TIME_PREVIEW_CREDITS,
  GENERATION_PREVIEW_CREDIT_COST,
  generationCreditCostForPreviewCount,
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
  it("models free preview access as one-time credits", () => {
    const plan = createPlanStatus({
      planKey: "free",
      generationJobs: [
        generationJob("succeeded"),
        generationJob("running"),
        generationJob("queued")
      ]
    });

    expect(plan.previewBatches.used).toBe(3);
    expect(plan.previewBatches.limit).toBeNull();
    expect(plan.previewBatches.remaining).toBeNull();
    expect(plan.previewBatches.previewsPerBatch).toBe(1);
    expect(FREE_PLAN_ONE_TIME_PREVIEW_CREDITS).toBe(15);
    expect(plan.canExportEtsyPack).toBe(false);
  });

  it("does not count failed or cancelled preview batches against usage", () => {
    const plan = createPlanStatus({
      planKey: "free",
      generationJobs: [
        generationJob("succeeded"),
        generationJob("failed"),
        generationJob("cancelled")
      ]
    });

    expect(plan.previewBatches.used).toBe(1);
    expect(plan.previewBatches.remaining).toBeNull();
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
    expect(plan.canExportEtsyPack).toBe(true);
  });

  it("limits free generation batches to one preview", () => {
    expect(previewCountForPlan({ requestedCount: 4, planKey: "free" })).toBe(1);
    expect(previewCountForPlan({ requestedCount: 4, planKey: "studio" })).toBe(
      4
    );
  });

  it("prices previews, variants, and Etsy pack exports at 5 credits", () => {
    expect(GENERATION_PREVIEW_CREDIT_COST).toBe(5);
    expect(generationCreditCostForPreviewCount(1)).toBe(5);
    expect(generationCreditCostForPreviewCount(2)).toBe(10);
    expect(ETSY_PACK_EXPORT_CREDIT_COST).toBe(5);
  });
});
