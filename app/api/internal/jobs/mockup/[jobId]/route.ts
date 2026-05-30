import { NextResponse } from "next/server";

import { ok } from "@/lib/api-response";
import { processMockupJob } from "@/lib/jobs/local-mockup-runner";
import { requireJobWorker } from "@/lib/jobs/worker-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const auth = requireJobWorker(request);

  if (!auth.ok) {
    return auth.response;
  }

  const { jobId } = await params;
  const result = await processMockupJob(jobId);

  return NextResponse.json(
    ok({
      jobId,
      processed: result.processed,
      status: result.job?.status ?? null
    })
  );
}
