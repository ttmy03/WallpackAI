import { getFirebaseAuth } from "@/lib/firebase/admin";

export type FirebaseSessionUser = {
  firebaseUid: string;
  email: string | null;
  emailVerified: boolean;
  signInProvider: string | null;
  name: string | null;
  picture: string | null;
};

type DecodedFirebaseUser = {
  uid: string;
  email?: unknown;
  email_verified?: unknown;
  firebase?: {
    sign_in_provider?: unknown;
  };
  name?: unknown;
  picture?: unknown;
};

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export async function getFirebaseUserFromRequest(
  request: Request
): Promise<FirebaseSessionUser | null> {
  const token = extractBearerToken(request);

  if (!token) {
    return null;
  }

  const decoded = await getFirebaseAuth().verifyIdToken(token);

  return mapDecodedFirebaseUser(decoded);
}

export function mapDecodedFirebaseUser(
  decoded: DecodedFirebaseUser
): FirebaseSessionUser {
  return {
    firebaseUid: decoded.uid,
    email: typeof decoded.email === "string" ? decoded.email : null,
    emailVerified: decoded.email_verified === true,
    signInProvider:
      typeof decoded.firebase?.sign_in_provider === "string"
        ? decoded.firebase.sign_in_provider
        : null,
    name: typeof decoded.name === "string" ? decoded.name : null,
    picture: typeof decoded.picture === "string" ? decoded.picture : null
  };
}
