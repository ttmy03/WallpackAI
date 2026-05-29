import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api-response";
import type { DashboardSummary } from "@/lib/app/api-types";
import { requireAppUser } from "@/lib/auth/api-auth";
import { getUserPlanStatus } from "@/lib/billing/plan-usage";
import { listFirestoreExportJobsForUser } from "@/lib/firestore/export-jobs";
import { listFirestoreGenerationJobsForUser } from "@/lib/firestore/generation-jobs";
import { getCreditBalance } from "@/lib/jobs/local-generation-runner";

export async function GET(request: Request) {
  try {
    const auth = await requireAppUser(request, "opening the dashboard");

    if (!auth.ok) {
      return auth.response;
    }

    const recentGenerationJobs = await listFirestoreGenerationJobsForUser(
      auth.firestoreUser.id,
      { limit: 5 }
    );
    const recentExportJobs = await listFirestoreExportJobsForUser(
      auth.firestoreUser.id,
      { limit: 5, includeSignedDownloadUrls: false }
    );
    const data: DashboardSummary = {
      plan: await getUserPlanStatus(auth.firestoreUser),
      creditBalance: await getCreditBalance(auth.firestoreUser.id),
      recentGenerationJobs,
      jobsNeedingAction: recentGenerationJobs.filter(
        (job) => job.status === "failed" || job.status === "cancelled"
      ).length,
      recentExportsCount: recentExportJobs.length
    };

    return NextResponse.json(ok(data));
  } catch (error) {
    console.error("Dashboard API failed", error);

    return NextResponse.json(
      fail(
        "DASHBOARD_LOAD_FAILED",
        "Dashboard data could not be loaded. Check the local dev server logs for details."
      ),
      { status: 500 }
    );
  }
}
