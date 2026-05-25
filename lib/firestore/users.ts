import type { FirebaseSessionUser } from "@/lib/auth/firebase-auth";
import { normalizePlanKey, type PlanKey } from "@/lib/billing/plans";
import { getFirebaseFirestore } from "@/lib/firebase/admin";
import {
  FIRESTORE_COLLECTIONS,
  userDocumentPath
} from "@/lib/firestore/collections";

export type FirestoreUser = {
  id: string;
  firebaseUid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  emailVerified: boolean;
  signInProvider: string | null;
  planKey: PlanKey;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  creditBalance: number;
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
      stripeCustomerId: existing?.stripeCustomerId ?? null,
      stripeSubscriptionId: existing?.stripeSubscriptionId ?? null,
      creditBalance: existing?.creditBalance ?? 0,
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

export async function updateFirestoreUserBillingPlan(input: {
  userId: string;
  planKey: PlanKey;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    planKey: input.planKey,
    updatedAt: now
  };

  if (input.stripeCustomerId !== undefined) {
    update.stripeCustomerId = input.stripeCustomerId;
  }

  if (input.stripeSubscriptionId !== undefined) {
    update.stripeSubscriptionId = input.stripeSubscriptionId;
  }

  await getFirebaseFirestore()
    .doc(userDocumentPath(input.userId))
    .set(update, { merge: true });

  const user = await getFirestoreUser(input.userId);

  if (!user) {
    throw new Error("User billing plan could not be loaded after update.");
  }

  return user;
}

export async function findFirestoreUserForStripeBilling(input: {
  userId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}) {
  if (input.userId) {
    const user = await getFirestoreUser(input.userId);

    if (user) {
      return user;
    }
  }

  const db = getFirebaseFirestore();

  if (input.stripeSubscriptionId) {
    const snapshot = await db
      .collection(FIRESTORE_COLLECTIONS.users)
      .where("stripeSubscriptionId", "==", input.stripeSubscriptionId)
      .limit(1)
      .get();
    const user = snapshot.docs[0];

    if (user) {
      return firestoreUserFromDocument(user.id, user.data());
    }
  }

  if (input.stripeCustomerId) {
    const snapshot = await db
      .collection(FIRESTORE_COLLECTIONS.users)
      .where("stripeCustomerId", "==", input.stripeCustomerId)
      .limit(1)
      .get();
    const user = snapshot.docs[0];

    if (user) {
      return firestoreUserFromDocument(user.id, user.data());
    }
  }

  return null;
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
    stripeCustomerId: nullableString(data.stripeCustomerId),
    stripeSubscriptionId: nullableString(data.stripeSubscriptionId),
    creditBalance: numberOrFallback(data.creditBalance, 0),
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

function numberOrFallback(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
