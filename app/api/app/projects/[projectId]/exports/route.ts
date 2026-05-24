import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api-response";
import type { ExportJobResponse } from "@/lib/app/api-types";
import { requireAppUser } from "@/lib/auth/api-auth";
import { enqueueLocalExportJob } from "@/lib/jobs/local-export-runner";
import {
  PRINT_RATIO_PRESET_KEYS,
  type PrintRatioPresetKey
} from "@/lib/print/presets";

const ratioKeys = PRINT_RATIO_PRESET_KEYS as [
  PrintRatioPresetKey,
  ...PrintRatioPresetKey[]
];

const exportRequestSchema = z.object({
  artworkId: z.string().trim().min(1).max(160),
  ratioKeys: z.array(z.enum(ratioKeys)).min(1).max(5).optional()
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const auth = await requireAppUser(request, "exporting Etsy packs");

  if (!auth.ok) {
    return auth.response;
  }

  const json: unknown = await request.json();
  const parsed = exportRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      fail(
        "VALIDATION_ERROR",
        "Export input is invalid.",
        parsed.error.flatten()
      ),
      { status: 400 }
    );
  }

  const { projectId } = await params;
  const result = await enqueueLocalExportJob({
    userId: auth.firestoreUser.id,
    projectId,
    artworkId: parsed.data.artworkId,
    ratioKeys: parsed.data.ratioKeys
  });

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
