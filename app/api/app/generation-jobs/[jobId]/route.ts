import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api-response";
import { requireAppUser } from "@/lib/auth/api-auth";
import { getLocalGenerationJobForUser } from "@/lib/jobs/local-generation-runner";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireAppUser(request, "reading jobs");

  if (!auth.ok) {
    return auth.response;
  }

  const { jobId } = await params;
  const job = await getLocalGenerationJobForUser(jobId, auth.firestoreUser.id);

  if (!job) {
    return NextResponse.json(
      fail("GENERATION_JOB_NOT_FOUND", "Generation job was not found."),
      { status: 404 }
    );
  }

  return NextResponse.json(ok(job));
}
