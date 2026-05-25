import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api-response";
import type { DeleteAccountResponse } from "@/lib/app/api-types";
import { requireAppUser } from "@/lib/auth/api-auth";
import { cancelStripeSubscriptionsForAccount } from "@/lib/billing/account-cancellation";
import { getFirebaseAuth } from "@/lib/firebase/admin";
import { deleteFirestoreAccountData } from "@/lib/firestore/account-deletion";

const ACCOUNT_DELETE_CONFIRMATION = "DELETE";

const deleteAccountSchema = z.object({
  confirmation: z.literal(ACCOUNT_DELETE_CONFIRMATION)
});

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  const auth = await requireAppUser(request, "deleting your account");

  if (!auth.ok) {
    return auth.response;
  }

  const json = await readJsonBody(request);
  const parsed = deleteAccountSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      fail(
        "VALIDATION_ERROR",
        "Type DELETE to confirm account deletion.",
        parsed.error.flatten()
      ),
      { status: 400 }
    );
  }

  try {
    await cancelStripeSubscriptionsForAccount({
      stripeCustomerId: auth.firestoreUser.stripeCustomerId,
      stripeSubscriptionId: auth.firestoreUser.stripeSubscriptionId
    });
    await deleteFirestoreAccountData(auth.firestoreUser.id);
    await getFirebaseAuth().deleteUser(auth.firestoreUser.firebaseUid);

    return NextResponse.json(ok<DeleteAccountResponse>({ deleted: true }));
  } catch (error) {
    return NextResponse.json(
      fail(
        "ACCOUNT_DELETE_FAILED",
        error instanceof Error
          ? error.message
          : "Your account could not be deleted."
      ),
      { status: 500 }
    );
  }
}

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return {};
  }
}
