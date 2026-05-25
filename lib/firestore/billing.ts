import type Stripe from "stripe";

import type { PlanKey } from "@/lib/billing/plans";
import { getFirebaseFirestore } from "@/lib/firebase/admin";
import {
  stripeWebhookEventDocumentPath,
  subscriptionDocumentPath
} from "@/lib/firestore/collections";

export async function hasProcessedStripeWebhookEvent(eventId: string) {
  const snapshot = await getFirebaseFirestore()
    .doc(stripeWebhookEventDocumentPath(eventId))
    .get();

  return snapshot.exists && snapshot.data()?.status === "processed";
}

export async function markStripeWebhookEventProcessed(input: {
  eventId: string;
  eventType: string;
}) {
  await getFirebaseFirestore()
    .doc(stripeWebhookEventDocumentPath(input.eventId))
    .set(
      {
        eventId: input.eventId,
        eventType: input.eventType,
        status: "processed",
        processedAt: new Date().toISOString()
      },
      { merge: true }
    );
}

export async function saveFirestoreStripeSubscription(input: {
  userId: string;
  planKey: PlanKey;
  subscription: Stripe.Subscription;
  latestEventId: string;
}) {
  const customerId =
    typeof input.subscription.customer === "string"
      ? input.subscription.customer
      : input.subscription.customer.id;
  const planItem = firstSubscriptionItem(input.subscription);
  const now = new Date().toISOString();

  await getFirebaseFirestore()
    .doc(subscriptionDocumentPath(input.subscription.id))
    .set(
      {
        userId: input.userId,
        planKey: input.planKey,
        stripeCustomerId: customerId,
        stripeSubscriptionId: input.subscription.id,
        stripePriceId: planItem?.price.id ?? null,
        status: input.subscription.status,
        currentPeriodStart: timestampSecondsToIso(
          planItem?.current_period_start
        ),
        currentPeriodEnd: timestampSecondsToIso(planItem?.current_period_end),
        cancelAtPeriodEnd: input.subscription.cancel_at_period_end,
        latestEventId: input.latestEventId,
        updatedAt: now
      },
      { merge: true }
    );
}

export function firstSubscriptionItem(subscription: Stripe.Subscription) {
  return subscription.items.data[0] ?? null;
}

export function timestampSecondsToIso(value: number | null | undefined) {
  if (!value) {
    return null;
  }

  return new Date(value * 1000).toISOString();
}
