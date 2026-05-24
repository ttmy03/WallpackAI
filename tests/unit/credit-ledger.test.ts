import { describe, expect, it } from "vitest";

import {
  InMemoryCreditLedger,
  InsufficientCreditsError
} from "@/lib/billing/credit-ledger";

describe("credit ledger", () => {
  it("applies grants idempotently", () => {
    const ledger = new InMemoryCreditLedger();

    ledger.grant({
      userId: "user_1",
      amount: 10,
      reason: "signup",
      idempotencyKey: "signup:user_1"
    });
    ledger.grant({
      userId: "user_1",
      amount: 10,
      reason: "signup duplicate",
      idempotencyKey: "signup:user_1"
    });

    expect(ledger.getBalance("user_1")).toBe(10);
    expect(ledger.getEntries("user_1")).toHaveLength(1);
  });

  it("prevents negative balances", () => {
    const ledger = new InMemoryCreditLedger();

    expect(() =>
      ledger.reserve({
        userId: "user_1",
        amount: 5,
        reason: "generation",
        idempotencyKey: "generation:reserve:job_1",
        relatedJobId: "job_1"
      })
    ).toThrow(InsufficientCreditsError);
  });

  it("reserves and refunds provider failures idempotently", () => {
    const ledger = new InMemoryCreditLedger();

    ledger.grant({
      userId: "user_1",
      amount: 5,
      reason: "admin grant",
      idempotencyKey: "grant:user_1"
    });
    ledger.reserve({
      userId: "user_1",
      amount: 2,
      reason: "generation",
      idempotencyKey: "generation:reserve:job_1",
      relatedJobId: "job_1"
    });
    ledger.refund({
      userId: "user_1",
      amount: 2,
      reason: "provider failed",
      idempotencyKey: "generation:refund:job_1",
      relatedJobId: "job_1"
    });
    ledger.refund({
      userId: "user_1",
      amount: 2,
      reason: "provider failed duplicate",
      idempotencyKey: "generation:refund:job_1",
      relatedJobId: "job_1"
    });

    expect(ledger.getBalance("user_1")).toBe(5);
    expect(ledger.getEntries("user_1")).toHaveLength(3);
  });
});
