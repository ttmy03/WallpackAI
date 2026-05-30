import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api-response";
import type { MockupJobResponse } from "@/lib/app/api-types";
import { requireAppUser } from "@/lib/auth/api-auth";
import { MOCKUP_PACK_CREDIT_COST } from "@/lib/billing/plans";
import { getCreditBalance } from "@/lib/jobs/local-generation-runner";
import { getJobRunner } from "@/lib/jobs/job-runner";
import {
  PRINT_RATIO_PRESET_KEYS,
  type PrintRatioPresetKey
} from "@/lib/print/presets";

const ratioKeys = PRINT_RATIO_PRESET_KEYS as [
  PrintRatioPresetKey,
  ...PrintRatioPresetKey[]
];

const mockupRequestSchema = z.object({
  artworkId: z.string().trim().min(1).max(160),
  ratioKey: z.enum(ratioKeys).optional()
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAppUser(request, "generating mockups");

  if (!auth.ok) {
    return auth.response;
  }

  const json: unknown = await request.json();
  const parsed = mockupRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      fail(
        "VALIDATION_ERROR",
        "Mockup input is invalid.",
        parsed.error.flatten()
      ),
      { status: 400 }
    );
  }

  const creditBalance = await getCreditBalance(auth.firestoreUser.id);

  if (creditBalance < MOCKUP_PACK_CREDIT_COST) {
    return NextResponse.json(
      fail(
        "INSUFFICIENT_CREDITS",
        `You need ${MOCKUP_PACK_CREDIT_COST} credits to create this mockup pack.`
      ),
      { status: 402 }
    );
  }

  const { projectId } = await params;
  const result = await getJobRunner().enqueueMockup({
    userId: auth.firestoreUser.id,
    projectId,
    artworkId: parsed.data.artworkId,
    ratioKey: parsed.data.ratioKey
  }).catch((error: unknown) => {
    if (error instanceof Error) {
      return { error };
    }

    return { error: new Error("Mockup pack could not be queued.") };
  });

  if ("error" in result) {
    return NextResponse.json(
      fail("MOCKUP_NOT_QUEUED", result.error.message),
      { status: 400 }
    );
  }

  if (!result.ok) {
    return NextResponse.json(fail(result.code, result.message), {
      status: result.status
    });
  }

  const data: MockupJobResponse = {
    jobId: result.job.jobId,
    status: result.job.status,
    projectId: result.job.projectId
  };

  return NextResponse.json(ok(data), { status: 202 });
}
