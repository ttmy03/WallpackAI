import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api-response";
import { getFirebaseUserFromRequest } from "@/lib/auth/firebase-auth";
import { isGoogleSignInProvider } from "@/lib/firebase/google-auth";
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
  const user = await getFirebaseUserFromRequest(request).catch(() => null);

  if (!user) {
    return NextResponse.json(
      fail("UNAUTHENTICATED", "A Firebase ID token is required."),
      { status: 401 }
    );
  }

  if (!isGoogleSignInProvider(user.signInProvider)) {
    return NextResponse.json(
      fail("PROVIDER_NOT_ALLOWED", "Sign in with Google before generating previews."),
      { status: 403 }
    );
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      fail("EMAIL_NOT_VERIFIED", "Confirm your email before generating previews."),
      { status: 403 }
    );
  }

  const json: unknown = await request.json();
  const parsed = generationRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      fail("VALIDATION_ERROR", "Generation input is invalid.", parsed.error.flatten()),
      { status: 400 }
    );
  }

  const result = await enqueueLocalGenerationJob({
    userId: user.firebaseUid,
    projectId: parsed.data.projectId,
    projectName: parsed.data.projectName,
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
