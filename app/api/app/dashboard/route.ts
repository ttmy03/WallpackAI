import { NextResponse } from "next/server";

import { ok } from "@/lib/api-response";
import type { DashboardSummary } from "@/lib/app/api-types";
import { requireAppUser } from "@/lib/auth/api-auth";
import { listFirestoreExportJobsForUser } from "@/lib/firestore/export-jobs";
import { listFirestoreGenerationJobsForUser } from "@/lib/firestore/generation-jobs";
import { listFirestoreProjectsForUser } from "@/lib/firestore/projects";
import { getLocalCreditBalance } from "@/lib/jobs/local-generation-runner";

export async function GET(request: Request) {
  const auth = await requireAppUser(request, "opening the dashboard");

  if (!auth.ok) {
    return auth.response;
  }

  const recentProjects = await listFirestoreProjectsForUser(
    auth.firestoreUser.id
  );
  const recentGenerationJobs = await listFirestoreGenerationJobsForUser(
    auth.firestoreUser.id,
    { limit: 5 }
  );
  const recentExportJobs = await listFirestoreExportJobsForUser(
    auth.firestoreUser.id,
    { limit: 5 }
  );
  const data: DashboardSummary = {
    creditBalance: getLocalCreditBalance(auth.firestoreUser.id),
    recentProjects: recentProjects.slice(0, 5),
    recentGenerationJobs,
    jobsNeedingAction: recentGenerationJobs.filter(
      (job) => job.status === "failed" || job.status === "cancelled"
    ).length,
    recentExportsCount: recentExportJobs.length
  };

  return NextResponse.json(ok(data));
}
