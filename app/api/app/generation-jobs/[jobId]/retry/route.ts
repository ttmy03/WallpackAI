import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api-response";
import type { RetryGenerationResponse } from "@/lib/app/api-types";
import { requireAppUser } from "@/lib/auth/api-auth";
import { retryLocalGenerationJob } from "@/lib/jobs/local-generation-runner";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = await requireAppUser(request, "retrying generation jobs");

  if (!auth.ok) {
    return auth.response;
  }

  const { jobId } = await params;
  const result = await retryLocalGenerationJob(jobId, auth.firestoreUser.id);

  if (!result.ok) {
    return NextResponse.json(fail(result.code, result.message), {
      status: result.status
    });
  }

  const data: RetryGenerationResponse = result.job;

  return NextResponse.json(ok(data), { status: 202 });
}
