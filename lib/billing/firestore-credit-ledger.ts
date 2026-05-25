import { createHash } from "node:crypto";

import {
  type ApplyCreditInput,
  type CreditLedgerEntry,
  InsufficientCreditsError
} from "@/lib/billing/credit-ledger";
import { getFirebaseFirestore } from "@/lib/firebase/admin";
import {
  creditLedgerEntryDocumentPath,
  userDocumentPath
} from "@/lib/firestore/collections";

type FirestoreCreditLedgerEntryDocument = Omit<
  CreditLedgerEntry,
  "createdAt"
> & {
  createdAt: string;
  metadata?: Record<string, unknown>;
};

type FirestoreCreditEntryInput = Omit<ApplyCreditInput, "amount"> & {
  amount: number | ((balanceBefore: number) => number);
  metadata?: Record<string, unknown>;
};

export async function getFirestoreCreditBalance(userId: string) {
  const snapshot = await getFirebaseFirestore()
    .doc(userDocumentPath(userId))
    .get();

  return numberOrFallback(snapshot.data()?.creditBalance, 0);
}

export async function grantFirestoreCredits(
  input: Omit<ApplyCreditInput, "amount" | "type"> & {
    amount: number;
    metadata?: Record<string, unknown>;
  }
) {
  return applyFirestoreCreditEntry({
    ...input,
    amount: Math.abs(input.amount),
    type: "grant"
  });
}

export async function reserveFirestoreCredits(
  input: Omit<ApplyCreditInput, "amount" | "type"> & { amount: number }
) {
  return applyFirestoreCreditEntry({
    ...input,
    amount: -Math.abs(input.amount),
    type: "reserve"
  });
}

export async function commitFirestoreCredits(
  input: Omit<ApplyCreditInput, "amount" | "type">
) {
  return applyFirestoreCreditEntry({ ...input, amount: 0, type: "commit" });
}

export async function refundFirestoreCredits(
  input: Omit<ApplyCreditInput, "amount" | "type"> & { amount: number }
) {
  return applyFirestoreCreditEntry({
    ...input,
    amount: Math.abs(input.amount),
    type: "refund"
  });
}

export async function resetFirestoreCredits(
  input: Omit<ApplyCreditInput, "amount" | "type"> & {
    balance: number;
    metadata?: Record<string, unknown>;
  }
) {
  return applyFirestoreCreditEntry({
    userId: input.userId,
    amount: (balanceBefore) => input.balance - balanceBefore,
    type: "reset",
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    relatedJobId: input.relatedJobId,
    metadata: input.metadata
  });
}

async function applyFirestoreCreditEntry(
  input: FirestoreCreditEntryInput
) {
  const db = getFirebaseFirestore();
  const entryId = creditEntryIdFromIdempotencyKey(input.idempotencyKey);
  const entryRef = db.doc(creditLedgerEntryDocumentPath(entryId));
  const userRef = db.doc(userDocumentPath(input.userId));

  return db.runTransaction(async (transaction) => {
    const existingEntry = await transaction.get(entryRef);

    if (existingEntry.exists) {
      return firestoreCreditEntryFromDocument(
        existingEntry.id,
        existingEntry.data() ?? {}
      );
    }

    const userSnapshot = await transaction.get(userRef);
    const balanceBefore = numberOrFallback(
      userSnapshot.data()?.creditBalance,
      0
    );
    const amount =
      typeof input.amount === "function"
        ? input.amount(balanceBefore)
        : input.amount;
    const balanceAfter = balanceBefore + amount;

    if (balanceAfter < 0) {
      throw new InsufficientCreditsError();
    }

    const now = new Date().toISOString();
    const entry: FirestoreCreditLedgerEntryDocument = {
      id: entryId,
      userId: input.userId,
      amount,
      balanceAfter,
      type: input.type,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      relatedJobId: input.relatedJobId,
      createdAt: now,
      metadata: input.metadata
    };

    transaction.create(entryRef, stripUndefined(entry));
    transaction.set(
      userRef,
      {
        creditBalance: balanceAfter,
        updatedAt: now
      },
      { merge: true }
    );

    return firestoreCreditEntryFromDocument(entryId, entry);
  });
}

function firestoreCreditEntryFromDocument(
  id: string,
  data: FirebaseFirestore.DocumentData
): CreditLedgerEntry {
  return {
    id,
    userId: stringOrFallback(data.userId, ""),
    amount: numberOrFallback(data.amount, 0),
    balanceAfter: numberOrFallback(data.balanceAfter, 0),
    type: creditLedgerEntryTypeOrFallback(data.type),
    reason: stringOrFallback(data.reason, ""),
    idempotencyKey: stringOrFallback(data.idempotencyKey, ""),
    relatedJobId: nullableString(data.relatedJobId) ?? undefined,
    createdAt: new Date(
      stringOrFallback(data.createdAt, new Date(0).toISOString())
    )
  };
}

function creditEntryIdFromIdempotencyKey(idempotencyKey: string) {
  const hash = createHash("sha256").update(idempotencyKey).digest("hex");
  return `cle_${hash.slice(0, 40)}`;
}

function creditLedgerEntryTypeOrFallback(
  value: unknown
): CreditLedgerEntry["type"] {
  if (
    value === "grant" ||
    value === "reserve" ||
    value === "commit" ||
    value === "refund" ||
    value === "reset" ||
    value === "admin_adjustment"
  ) {
    return value;
  }

  return "admin_adjustment";
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  );
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
