import { NextResponse } from "next/server";

import { fail } from "@/lib/api-response";
import { getFirebaseUserFromRequest } from "@/lib/auth/firebase-auth";
import { isGoogleSignInProvider } from "@/lib/firebase/google-auth";
import {
  type FirestoreUser,
  upsertFirestoreUserFromSession
} from "@/lib/firestore/users";

type AuthenticatedAppRequest =
  | {
      ok: true;
      firestoreUser: FirestoreUser;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireAppUser(
  request: Request,
  action: string
): Promise<AuthenticatedAppRequest> {
  let user;

  try {
    user = await getFirebaseUserFromRequest(request);
  } catch (error) {
    if (isFirebaseAdminConfigurationError(error)) {
      return firebaseAdminConfigurationResponse();
    }

    user = null;
  }

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        fail("UNAUTHENTICATED", "A Firebase ID token is required."),
        { status: 401 }
      )
    };
  }

  if (!isGoogleSignInProvider(user.signInProvider)) {
    return {
      ok: false,
      response: NextResponse.json(
        fail("PROVIDER_NOT_ALLOWED", `Sign in with Google before ${action}.`),
        { status: 403 }
      )
    };
  }

  if (!user.emailVerified) {
    return {
      ok: false,
      response: NextResponse.json(
        fail("EMAIL_NOT_VERIFIED", `Confirm your email before ${action}.`),
        { status: 403 }
      )
    };
  }

  let firestoreUser: FirestoreUser;

  try {
    firestoreUser = await upsertFirestoreUserFromSession(user);
  } catch (error) {
    if (isFirebaseAdminConfigurationError(error)) {
      return firebaseAdminConfigurationResponse();
    }

    throw error;
  }

  return {
    ok: true,
    firestoreUser
  };
}

function isFirebaseAdminConfigurationError(error: unknown) {
  const code = getErrorCode(error);
  const message = error instanceof Error ? error.message : "";

  return (
    code === "app/invalid-credential" ||
    code === "app/invalid-app-options" ||
    message.includes("Could not load the default credentials") ||
    message.includes("Unable to detect a Project Id")
  );
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return null;
  }

  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function firebaseAdminConfigurationResponse(): AuthenticatedAppRequest {
  return {
    ok: false,
    response: NextResponse.json(
      fail(
        "FIREBASE_ADMIN_NOT_CONFIGURED",
        "Local API routes need Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or run Google application-default auth for project wallpackai."
      ),
      { status: 500 }
    )
  };
}
