import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api-response";
import { getFirebaseUserFromRequest } from "@/lib/auth/firebase-auth";
import { isGoogleSignInProvider } from "@/lib/firebase/google-auth";
import { createProjectSchema } from "@/lib/validations/project";

export async function GET() {
  return NextResponse.json(
    ok({
      projects: [
        {
          id: "demo-japandi",
          name: "Japandi Mountain Set",
          status: "draft"
        }
      ]
    })
  );
}

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
      fail(
        "PROVIDER_NOT_ALLOWED",
        "Sign in with Google before creating projects."
      ),
      { status: 403 }
    );
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      fail("EMAIL_NOT_VERIFIED", "Confirm your email before creating projects."),
      { status: 403 }
    );
  }

  const json: unknown = await request.json();
  const parsed = createProjectSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      fail("VALIDATION_ERROR", "Project input is invalid.", parsed.error.flatten()),
      { status: 400 }
    );
  }

  return NextResponse.json(
    fail(
      "PROJECT_REPOSITORY_NOT_CONFIGURED",
      "Firebase Auth is connected at the API boundary; persistent project storage is not connected yet.",
      { firebaseUid: user.firebaseUid }
    ),
    { status: 501 }
  );
}
