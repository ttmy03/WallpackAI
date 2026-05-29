import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { fail } from "@/lib/api-response";

export function requireJobWorker(request: Request) {
  const expectedSecret = process.env.JOB_WORKER_SECRET;

  if (!expectedSecret) {
    return {
      ok: false as const,
      response: NextResponse.json(
        fail(
          "JOB_WORKER_SECRET_NOT_CONFIGURED",
          "Job worker authentication is not configured."
        ),
        { status: 500 }
      )
    };
  }

  const providedSecret = request.headers.get("x-wallpack-job-secret") ?? "";

  if (!secretsMatch(providedSecret, expectedSecret)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        fail("UNAUTHORIZED_JOB_WORKER", "Job worker authentication failed."),
        { status: 401 }
      )
    };
  }

  return { ok: true as const };
}

function secretsMatch(provided: string, expected: string) {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);

  return (
    providedBytes.byteLength === expectedBytes.byteLength &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
}
