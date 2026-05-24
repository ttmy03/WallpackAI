import type { FirebaseSessionUser } from "@/lib/auth/firebase-auth";
import { normalizePlanKey, type PlanKey } from "@/lib/billing/plans";
import { getFirebaseFirestore } from "@/lib/firebase/admin";
import { userDocumentPath } from "@/lib/firestore/collections";

export type FirestoreUser = {
  id: string;
  firebaseUid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  emailVerified: boolean;
  signInProvider: string | null;
  planKey: PlanKey;
  onboardingComplete: boolean;
  defaultAiDisclosure: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function upsertFirestoreUserFromSession(
  sessionUser: FirebaseSessionUser
): Promise<FirestoreUser> {
  const db = getFirebaseFirestore();
  const ref = db.doc(userDocumentPath(sessionUser.firebaseUid));
  const now = new Date().toISOString();

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const existing = snapshot.exists
      ? firestoreUserFromDocument(
          sessionUser.firebaseUid,
          snapshot.data() ?? {}
        )
      : null;
    const user: FirestoreUser = {
      id: sessionUser.firebaseUid,
      firebaseUid: sessionUser.firebaseUid,
      email: sessionUser.email,
      name: sessionUser.name,
      picture: sessionUser.picture,
      emailVerified: sessionUser.emailVerified,
      signInProvider: sessionUser.signInProvider,
      planKey: existing?.planKey ?? "free",
      onboardingComplete: existing?.onboardingComplete ?? false,
      defaultAiDisclosure: existing?.defaultAiDisclosure ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    transaction.set(ref, user, { merge: true });
    return user;
  });
}

export async function getFirestoreUser(userId: string) {
  const snapshot = await getFirebaseFirestore()
    .doc(userDocumentPath(userId))
    .get();

  if (!snapshot.exists) {
    return null;
  }

  return firestoreUserFromDocument(userId, snapshot.data() ?? {});
}

export async function updateFirestoreUserSettings(
  userId: string,
  input: { defaultAiDisclosure: boolean }
) {
  const now = new Date().toISOString();

  await getFirebaseFirestore().doc(userDocumentPath(userId)).set(
    {
      defaultAiDisclosure: input.defaultAiDisclosure,
      updatedAt: now
    },
    { merge: true }
  );

  const user = await getFirestoreUser(userId);

  if (!user) {
    throw new Error("User settings could not be loaded after update.");
  }

  return user;
}

export function firestoreUserFromDocument(
  id: string,
  data: FirebaseFirestore.DocumentData
): FirestoreUser {
  return {
    id,
    firebaseUid: stringOrFallback(data.firebaseUid, id),
    email: nullableString(data.email),
    name: nullableString(data.name),
    picture: nullableString(data.picture),
    emailVerified: data.emailVerified === true,
    signInProvider: nullableString(data.signInProvider),
    planKey: normalizePlanKey(data.planKey),
    onboardingComplete: data.onboardingComplete === true,
    defaultAiDisclosure: data.defaultAiDisclosure !== false,
    createdAt: stringOrFallback(data.createdAt, new Date(0).toISOString()),
    updatedAt: stringOrFallback(data.updatedAt, new Date(0).toISOString())
  };
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function stringOrFallback(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}
