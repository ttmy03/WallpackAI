import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api-response";
import { requireAppUser } from "@/lib/auth/api-auth";
import { cancelLocalGenerationJob } from "@/lib/jobs/local-generation-runner";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireAppUser(request, "cancelling generation jobs");

  if (!auth.ok) {
    return auth.response;
  }

  const { jobId } = await params;
  const result = await cancelLocalGenerationJob(jobId, auth.firestoreUser.id);

  if (!result.ok) {
    return NextResponse.json(fail(result.code, result.message), {
      status: result.status
    });
  }

  return NextResponse.json(ok(result.job));
}
