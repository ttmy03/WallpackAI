import type Stripe from "stripe";

import { resetFirestoreCredits } from "@/lib/billing/firestore-credit-ledger";
import { PLAN_MONTHLY_CREDITS, type PlanKey } from "@/lib/billing/plans";
import {
  getStripe,
  planKeyFromStripeSubscription,
  stripeCustomerIdFromValue,
  stripeSubscriptionIdFromValue
} from "@/lib/billing/stripe";
import {
  firstSubscriptionItem,
  hasProcessedStripeWebhookEvent,
  markStripeWebhookEventProcessed,
  saveFirestoreStripeSubscription,
  timestampSecondsToIso
} from "@/lib/firestore/billing";
import {
  findFirestoreUserForStripeBilling,
  updateFirestoreUserBillingPlan
} from "@/lib/firestore/users";

export async function processStripeWebhookEvent(event: Stripe.Event) {
  if (await hasProcessedStripeWebhookEvent(event.id)) {
    return { processed: false as const, duplicate: true as const };
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutSessionCompleted(
        event.data.object as Stripe.Checkout.Session,
        event.id
      );
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncStripeSubscription({
        subscription: event.data.object as Stripe.Subscription,
        eventId: event.id
      });
      break;
    default:
      break;
  }

  await markStripeWebhookEventProcessed({
    eventId: event.id,
    eventType: event.type
  });

  return { processed: true as const, duplicate: false as const };
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  eventId: string
) {
  if (session.mode !== "subscription") {
    return;
  }

  const subscriptionId = stripeSubscriptionIdFromValue(session.subscription);

  if (!subscriptionId) {
    throw new Error("Checkout session is missing a subscription id.");
  }

  const subscription = await getStripe().subscriptions.retrieve(
    subscriptionId,
    {
      expand: ["items.data.price"]
    }
  );

  await syncStripeSubscription({
    subscription,
    eventId,
    fallbackUserId:
      session.metadata?.firebaseUid ??
      session.metadata?.userId ??
      session.client_reference_id,
    fallbackCustomerId: stripeCustomerIdFromValue(session.customer)
  });
}

async function syncStripeSubscription(input: {
  subscription: Stripe.Subscription;
  eventId: string;
  fallbackUserId?: string | null;
  fallbackCustomerId?: string | null;
}) {
  const customerId =
    input.fallbackCustomerId ??
    stripeCustomerIdFromValue(input.subscription.customer);
  const metadataUserId =
    input.subscription.metadata.firebaseUid ??
    input.subscription.metadata.userId;
  const user = await findFirestoreUserForStripeBilling({
    userId: input.fallbackUserId ?? metadataUserId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: input.subscription.id
  });

  if (!user) {
    if (input.subscription.status === "canceled") {
      return;
    }

    throw new Error(
      `No Firestore user found for Stripe subscription ${input.subscription.id}.`
    );
  }

  const planKey = planKeyForSubscriptionEntitlement(input.subscription);

  await updateFirestoreUserBillingPlan({
    userId: user.id,
    planKey,
    stripeCustomerId: customerId,
    stripeSubscriptionId:
      input.subscription.status === "canceled" ? null : input.subscription.id
  });
  await saveFirestoreStripeSubscription({
    userId: user.id,
    planKey,
    subscription: input.subscription,
    latestEventId: input.eventId
  });
  await resetSubscriptionCredits({
    userId: user.id,
    planKey,
    subscription: input.subscription,
    eventId: input.eventId,
    stripeCustomerId: customerId
  });
}

function planKeyForSubscriptionEntitlement(subscription: Stripe.Subscription) {
  if (!isEntitledSubscriptionStatus(subscription.status)) {
    return "free" satisfies PlanKey;
  }

  return planKeyFromStripeSubscription(subscription);
}

function isEntitledSubscriptionStatus(status: Stripe.Subscription.Status) {
  return status === "active" || status === "trialing";
}

async function resetSubscriptionCredits(input: {
  userId: string;
  planKey: PlanKey;
  subscription: Stripe.Subscription;
  eventId: string;
  stripeCustomerId: string | null;
}) {
  const balance = PLAN_MONTHLY_CREDITS[input.planKey];
  const period = subscriptionCreditPeriod(input.subscription);

  if (balance <= 0 || !period.start) {
    return;
  }

  await resetFirestoreCredits({
    userId: input.userId,
    balance,
    reason: `${input.planKey} monthly credit reset`,
    idempotencyKey: [
      "stripe",
      "subscription",
      input.subscription.id,
      "credits",
      period.start.toString(),
      input.planKey
    ].join(":"),
    relatedJobId: input.subscription.id,
    metadata: {
      stripeEventId: input.eventId,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.subscription.id,
      stripeSubscriptionStatus: input.subscription.status,
      planKey: input.planKey,
      resetBalanceTo: balance,
      currentPeriodStart: timestampSecondsToIso(period.start),
      currentPeriodEnd: timestampSecondsToIso(period.end)
    }
  });
}

function subscriptionCreditPeriod(subscription: Stripe.Subscription) {
  const item = firstSubscriptionItem(subscription);

  return {
    start: item?.current_period_start ?? null,
    end: item?.current_period_end ?? null
  };
}
