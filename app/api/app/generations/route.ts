import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api-response";
import { requireAppUser } from "@/lib/auth/api-auth";
import {
  createFirestoreProject,
  getFirestoreProjectForUser
} from "@/lib/firestore/projects";
import { enqueueLocalGenerationJob } from "@/lib/jobs/local-generation-runner";
import { promptInputSchema } from "@/lib/prompts/schema";

const generationRequestSchema = z.object({
  projectId: z.string().trim().min(1).max(120).optional(),
  projectName: z.string().trim().min(2).max(80).optional(),
  promptInputs: promptInputSchema,
  previewCount: z.number().int().min(1).max(4).default(2),
  quality: z.enum(["draft", "standard", "premium"]).default("draft")
});

export async function POST(request: Request) {
  const auth = await requireAppUser(request, "generating previews");

  if (!auth.ok) {
    return auth.response;
  }

  const json: unknown = await request.json();
  const parsed = generationRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      fail(
        "VALIDATION_ERROR",
        "Generation input is invalid.",
        parsed.error.flatten()
      ),
      { status: 400 }
    );
  }

  const firestoreUser = auth.firestoreUser;
  const project = parsed.data.projectId
    ? await getFirestoreProjectForUser(firestoreUser.id, parsed.data.projectId)
    : await createFirestoreProject({
        userId: firestoreUser.id,
        name:
          parsed.data.projectName ??
          parsed.data.promptInputs.packName ??
          parsed.data.promptInputs.subject,
        promptInputs: parsed.data.promptInputs
      });

  if (!project) {
    return NextResponse.json(
      fail("PROJECT_NOT_FOUND", "Project was not found for this account."),
      { status: 404 }
    );
  }

  const result = await enqueueLocalGenerationJob({
    userId: firestoreUser.id,
    projectId: project.id,
    projectName: project.name,
    promptInputs: parsed.data.promptInputs,
    previewCount: parsed.data.previewCount,
    quality: parsed.data.quality
  }).catch((error: unknown) => {
    if (error instanceof Error) {
      return { error };
    }

    return { error: new Error("Generation could not be queued.") };
  });

  if ("error" in result) {
    return NextResponse.json(
      fail("GENERATION_NOT_QUEUED", result.error.message),
      { status: 400 }
    );
  }

  return NextResponse.json(ok(result), { status: 202 });
}
