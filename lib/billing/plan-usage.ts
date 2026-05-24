import { createPlanStatus, type PlanStatus } from "@/lib/billing/plans";
import type { FirestoreUser } from "@/lib/firestore/users";
import { listFirestoreGenerationJobsForUser } from "@/lib/firestore/generation-jobs";

export async function getUserPlanStatus(
  user: Pick<FirestoreUser, "id" | "planKey">
): Promise<PlanStatus> {
  const generationJobs = await listFirestoreGenerationJobsForUser(user.id, {
    limit: 100
  });

  return createPlanStatus({
    planKey: user.planKey,
    generationJobs
  });
}
