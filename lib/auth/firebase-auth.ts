import { getFirebaseAuth } from "@/lib/firebase/admin";

export type FirebaseSessionUser = {
  firebaseUid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
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

  return {
    firebaseUid: decoded.uid,
    email: decoded.email ?? null,
    name: typeof decoded.name === "string" ? decoded.name : null,
    picture: typeof decoded.picture === "string" ? decoded.picture : null
  };
}
