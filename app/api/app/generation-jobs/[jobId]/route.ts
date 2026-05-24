import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api-response";
import { getFirebaseUserFromRequest } from "@/lib/auth/firebase-auth";
import { isGoogleSignInProvider } from "@/lib/firebase/google-auth";
import { getLocalGenerationJobForUser } from "@/lib/jobs/local-generation-runner";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const user = await getFirebaseUserFromRequest(request).catch(() => null);

  if (!user) {
    return NextResponse.json(
      fail("UNAUTHENTICATED", "A Firebase ID token is required."),
      { status: 401 }
    );
  }

  if (!isGoogleSignInProvider(user.signInProvider)) {
    return NextResponse.json(
      fail("PROVIDER_NOT_ALLOWED", "Sign in with Google before reading jobs."),
      { status: 403 }
    );
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      fail("EMAIL_NOT_VERIFIED", "Confirm your email before reading jobs."),
      { status: 403 }
    );
  }

  const { jobId } = await params;
  const job = getLocalGenerationJobForUser(jobId, user.firebaseUid);

  if (!job) {
    return NextResponse.json(
      fail("GENERATION_JOB_NOT_FOUND", "Generation job was not found."),
      { status: 404 }
    );
  }

  return NextResponse.json(ok(job));
}
