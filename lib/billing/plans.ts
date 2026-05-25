import type { GenerationJobView } from "@/lib/jobs/generation-types";

export const FREE_PLAN_KEY = "free";
export const FREE_PLAN_PREVIEWS_PER_BATCH = 1;
export const FREE_PLAN_ONE_TIME_PREVIEW_CREDITS = 15;
export const GENERATION_PREVIEW_CREDIT_COST = 5;
export const ETSY_PACK_EXPORT_CREDIT_COST = 5;

export const PLAN_KEYS = ["free", "starter", "studio", "batch"] as const;
export const PAID_PLAN_KEYS = ["starter", "studio", "batch"] as const;

export type PlanKey = (typeof PLAN_KEYS)[number];
export type PaidPlanKey = (typeof PAID_PLAN_KEYS)[number];

export type PlanStatus = {
  planKey: PlanKey;
  label: string;
  canExportEtsyPack: boolean;
  previewBatches: {
    used: number;
    limit: number | null;
    remaining: number | null;
    previewsPerBatch: number;
  };
};

const PLAN_LABELS: Record<PlanKey, string> = {
  free: "Free",
  starter: "Starter",
  studio: "Studio",
  batch: "Batch"
};

export const PLAN_MONTHLY_CREDITS: Record<PlanKey, number> = {
  free: 0,
  starter: 80,
  studio: 260,
  batch: 900
};

export function normalizePlanKey(value: unknown): PlanKey {
  return PLAN_KEYS.includes(value as PlanKey) ? (value as PlanKey) : "free";
}

export function isFreePlan(planKey: PlanKey) {
  return planKey === FREE_PLAN_KEY;
}

export function planLabelForPlanKey(planKey: PlanKey) {
  return PLAN_LABELS[planKey];
}

export function createPlanStatus(input: {
  planKey: PlanKey;
  generationJobs: Pick<GenerationJobView, "requestedCount" | "status">[];
}): PlanStatus {
  const used = countPreviewBatchesForPlanLimit(input.generationJobs);
  return {
    planKey: input.planKey,
    label: PLAN_LABELS[input.planKey],
    canExportEtsyPack: !isFreePlan(input.planKey),
    previewBatches: {
      used,
      limit: null,
      remaining: null,
      previewsPerBatch: FREE_PLAN_PREVIEWS_PER_BATCH
    }
  };
}

export function previewCountForPlan(input: {
  requestedCount: number;
  planKey: PlanKey;
}) {
  if (!isFreePlan(input.planKey)) {
    return input.requestedCount;
  }

  return FREE_PLAN_PREVIEWS_PER_BATCH;
}

export function generationCreditCostForPreviewCount(previewCount: number) {
  if (!Number.isFinite(previewCount) || previewCount <= 0) {
    return 0;
  }

  return Math.trunc(previewCount) * GENERATION_PREVIEW_CREDIT_COST;
}

function countPreviewBatchesForPlanLimit(
  generationJobs: Pick<GenerationJobView, "requestedCount" | "status">[]
) {
  return generationJobs.filter(
    (job) =>
      job.requestedCount > 0 &&
      job.status !== "failed" &&
      job.status !== "cancelled"
  ).length;
}
