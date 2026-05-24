import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api-response";
import { requireAppUser } from "@/lib/auth/api-auth";
import { getLocalExportJobForUser } from "@/lib/jobs/local-export-runner";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireAppUser(request, "reading export jobs");

  if (!auth.ok) {
    return auth.response;
  }

  const { jobId } = await params;
  const job = await getLocalExportJobForUser(jobId, auth.firestoreUser.id);

  if (!job) {
    return NextResponse.json(
      fail("EXPORT_JOB_NOT_FOUND", "Export job was not found."),
      { status: 404 }
    );
  }

  return NextResponse.json(ok(job));
}
