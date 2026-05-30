import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api-response";
import { requireAppUser } from "@/lib/auth/api-auth";
import { getLocalMockupJobForUser } from "@/lib/jobs/local-mockup-runner";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireAppUser(request, "reading mockup jobs");

  if (!auth.ok) {
    return auth.response;
  }

  const { jobId } = await params;
  const job = await getLocalMockupJobForUser(jobId, auth.firestoreUser.id);

  if (!job) {
    return NextResponse.json(
      fail("MOCKUP_JOB_NOT_FOUND", "Mockup job was not found."),
      { status: 404 }
    );
  }

  return NextResponse.json(ok(job));
}
