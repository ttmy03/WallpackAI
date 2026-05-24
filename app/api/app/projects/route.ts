import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api-response";
import { getFirebaseUserFromRequest } from "@/lib/auth/firebase-auth";
import { isGoogleSignInProvider } from "@/lib/firebase/google-auth";
import {
  createFirestoreProject,
  listFirestoreProjectsForUser
} from "@/lib/firestore/projects";
import { upsertFirestoreUserFromSession } from "@/lib/firestore/users";
import { createProjectSchema } from "@/lib/validations/project";

export async function GET(request: Request) {
  const user = await getFirebaseUserFromRequest(request).catch(() => null);

  if (!user) {
    return NextResponse.json(
      fail("UNAUTHENTICATED", "A Firebase ID token is required."),
      { status: 401 }
    );
  }

  if (!isGoogleSignInProvider(user.signInProvider)) {
    return NextResponse.json(
      fail("PROVIDER_NOT_ALLOWED", "Sign in with Google before reading projects."),
      { status: 403 }
    );
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      fail("EMAIL_NOT_VERIFIED", "Confirm your email before reading projects."),
      { status: 403 }
    );
  }

  const firestoreUser = await upsertFirestoreUserFromSession(user);
  const projects = await listFirestoreProjectsForUser(firestoreUser.id);

  return NextResponse.json(ok({ projects }));
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

  const firestoreUser = await upsertFirestoreUserFromSession(user);
  const project = await createFirestoreProject({
    userId: firestoreUser.id,
    name: parsed.data.name,
    promptInputs: parsed.data.promptInputs
  });

  return NextResponse.json(ok({ projectId: project.id }), { status: 201 });
}
