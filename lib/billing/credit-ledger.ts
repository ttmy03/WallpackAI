export type CreditLedgerEntryType =
  | "grant"
  | "reserve"
  | "commit"
  | "refund"
  | "reset"
  | "admin_adjustment";

export type CreditLedgerEntry = {
  id: string;
  userId: string;
  amount: number;
  balanceAfter: number;
  type: CreditLedgerEntryType;
  reason: string;
  idempotencyKey: string;
  relatedJobId?: string;
  createdAt: Date;
};

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}

export class InMemoryCreditLedger {
  private entries: CreditLedgerEntry[] = [];
  private idempotencyIndex = new Map<string, CreditLedgerEntry>();

  getEntries(userId: string) {
    return this.entries.filter((entry) => entry.userId === userId);
  }

  getBalance(userId: string) {
    return this.getEntries(userId).at(-1)?.balanceAfter ?? 0;
  }

  grant(input: Omit<ApplyCreditInput, "amount" | "type"> & { amount: number }) {
    return this.apply({
      ...input,
      amount: Math.abs(input.amount),
      type: "grant"
    });
  }

  reserve(
    input: Omit<ApplyCreditInput, "amount" | "type"> & { amount: number }
  ) {
    return this.apply({
      ...input,
      amount: -Math.abs(input.amount),
      type: "reserve"
    });
  }

  commit(input: Omit<ApplyCreditInput, "amount" | "type">) {
    return this.apply({ ...input, amount: 0, type: "commit" });
  }

  refund(
    input: Omit<ApplyCreditInput, "amount" | "type"> & { amount: number }
  ) {
    return this.apply({
      ...input,
      amount: Math.abs(input.amount),
      type: "refund"
    });
  }

  reset(
    input: Omit<ApplyCreditInput, "amount" | "type"> & { balance: number }
  ) {
    return this.apply({
      ...input,
      amount: input.balance - this.getBalance(input.userId),
      type: "reset"
    });
  }

  apply(input: ApplyCreditInput) {
    const existing = this.idempotencyIndex.get(input.idempotencyKey);
    if (existing) {
      return existing;
    }

    const balanceAfter = this.getBalance(input.userId) + input.amount;

    if (balanceAfter < 0) {
      throw new InsufficientCreditsError();
    }

    const entry: CreditLedgerEntry = {
      id: `cle_${this.entries.length + 1}`,
      userId: input.userId,
      amount: input.amount,
      balanceAfter,
      type: input.type,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      relatedJobId: input.relatedJobId,
      createdAt: new Date()
    };

    this.entries.push(entry);
    this.idempotencyIndex.set(entry.idempotencyKey, entry);

    return entry;
  }
}

export type ApplyCreditInput = {
  userId: string;
  amount: number;
  type: CreditLedgerEntryType;
  reason: string;
  idempotencyKey: string;
  relatedJobId?: string;
};
