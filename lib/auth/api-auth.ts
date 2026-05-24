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
  const user = await getFirebaseUserFromRequest(request).catch(() => null);

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

  return {
    ok: true,
    firestoreUser: await upsertFirestoreUserFromSession(user)
  };
}
