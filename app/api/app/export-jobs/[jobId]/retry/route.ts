import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api-response";
import type { ExportJobResponse } from "@/lib/app/api-types";
import { requireAppUser } from "@/lib/auth/api-auth";
import { retryLocalExportJob } from "@/lib/jobs/local-export-runner";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireAppUser(request, "retrying export jobs");

  if (!auth.ok) {
    return auth.response;
  }

  const { jobId } = await params;
  const result = await retryLocalExportJob(jobId, auth.firestoreUser.id);

  if (!result.ok) {
    return NextResponse.json(fail(result.code, result.message), {
      status: result.status
    });
  }

  const data: ExportJobResponse = {
    jobId: result.job.jobId,
    status: result.job.status,
    projectId: result.job.projectId
  };

  return NextResponse.json(ok(data), { status: 202 });
}
