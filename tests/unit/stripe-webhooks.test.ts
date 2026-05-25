import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PLAN_MONTHLY_CREDITS } from "@/lib/billing/plans";
import { processStripeWebhookEvent } from "@/lib/billing/stripe-webhooks";

const mocks = vi.hoisted(() => ({
  findFirestoreUserForStripeBilling: vi.fn(),
  hasProcessedStripeWebhookEvent: vi.fn(),
  markStripeWebhookEventProcessed: vi.fn(),
  resetFirestoreCredits: vi.fn(),
  saveFirestoreStripeSubscription: vi.fn(),
  updateFirestoreUserBillingPlan: vi.fn()
}));

vi.mock("@/lib/billing/firestore-credit-ledger", () => ({
  resetFirestoreCredits: mocks.resetFirestoreCredits
}));

vi.mock("@/lib/firestore/billing", () => ({
  firstSubscriptionItem: (subscription: Stripe.Subscription) =>
    subscription.items.data[0] ?? null,
  hasProcessedStripeWebhookEvent: mocks.hasProcessedStripeWebhookEvent,
  markStripeWebhookEventProcessed: mocks.markStripeWebhookEventProcessed,
  saveFirestoreStripeSubscription: mocks.saveFirestoreStripeSubscription,
  timestampSecondsToIso: (value: number | null | undefined) =>
    value ? new Date(value * 1000).toISOString() : null
}));

vi.mock("@/lib/firestore/users", () => ({
  findFirestoreUserForStripeBilling: mocks.findFirestoreUserForStripeBilling,
  updateFirestoreUserBillingPlan: mocks.updateFirestoreUserBillingPlan
}));

describe("Stripe webhook credit resets", () => {
  const previousEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...previousEnv };
    process.env.STRIPE_PRICE_STARTER_ID = "price_starter";
    mocks.hasProcessedStripeWebhookEvent.mockResolvedValue(false);
    mocks.findFirestoreUserForStripeBilling.mockResolvedValue({
      id: "user_1"
    });
  });

  it("resets paid subscription credits to the plan monthly balance", async () => {
    const periodStart = 1_779_811_200;
    const periodEnd = 1_782_403_200;
    const subscription = stripeSubscription({
      id: "sub_123",
      priceId: "price_starter",
      periodStart,
      periodEnd
    });

    await processStripeWebhookEvent({
      id: "evt_123",
      type: "customer.subscription.updated",
      data: { object: subscription }
    } as Stripe.Event);

    expect(mocks.resetFirestoreCredits).toHaveBeenCalledWith({
      userId: "user_1",
      balance: PLAN_MONTHLY_CREDITS.starter,
      reason: "starter monthly credit reset",
      idempotencyKey:
        "stripe:subscription:sub_123:credits:1779811200:starter",
      relatedJobId: "sub_123",
      metadata: {
        stripeEventId: "evt_123",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        stripeSubscriptionStatus: "active",
        planKey: "starter",
        resetBalanceTo: PLAN_MONTHLY_CREDITS.starter,
        currentPeriodStart: new Date(periodStart * 1000).toISOString(),
        currentPeriodEnd: new Date(periodEnd * 1000).toISOString()
      }
    });
  });
});

function stripeSubscription(input: {
  id: string;
  priceId: string;
  periodStart: number;
  periodEnd: number;
}) {
  return {
    id: input.id,
    status: "active",
    customer: "cus_123",
    metadata: { firebaseUid: "user_1" },
    cancel_at_period_end: false,
    items: {
      data: [
        {
          price: { id: input.priceId },
          current_period_start: input.periodStart,
          current_period_end: input.periodEnd
        }
      ]
    }
  } as unknown as Stripe.Subscription;
}
