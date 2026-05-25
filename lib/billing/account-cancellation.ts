import type Stripe from "stripe";

import { getStripe } from "@/lib/billing/stripe";

export async function cancelStripeSubscriptionsForAccount(input: {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}) {
  if (!input.stripeCustomerId && !input.stripeSubscriptionId) {
    return;
  }

  const stripe = getStripe();
  const subscriptionIds = new Set<string>();

  if (input.stripeSubscriptionId) {
    subscriptionIds.add(input.stripeSubscriptionId);
  }

  if (input.stripeCustomerId) {
    await addCustomerSubscriptionIds(
      stripe,
      input.stripeCustomerId,
      subscriptionIds
    );
  }

  await Promise.all(
    [...subscriptionIds].map((subscriptionId) =>
      cancelStripeSubscriptionIfActive(stripe, subscriptionId)
    )
  );
}

async function cancelStripeSubscriptionIfActive(
  stripe: Stripe,
  subscriptionId: string
) {
  let subscription: Stripe.Subscription;

  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    if (isMissingStripeResource(error)) {
      return;
    }

    throw error;
  }

  if (!shouldCancelSubscription(subscription.status)) {
    return;
  }

  try {
    await stripe.subscriptions.cancel(subscriptionId);
  } catch (error) {
    if (!isMissingStripeResource(error)) {
      throw error;
    }
  }
}

async function addCustomerSubscriptionIds(
  stripe: Stripe,
  stripeCustomerId: string,
  subscriptionIds: Set<string>
) {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
      limit: 100
    });

    for (const subscription of subscriptions.data) {
      if (shouldCancelSubscription(subscription.status)) {
        subscriptionIds.add(subscription.id);
      }
    }
  } catch (error) {
    if (!isMissingStripeResource(error)) {
      throw error;
    }
  }
}

function shouldCancelSubscription(status: Stripe.Subscription.Status) {
  return status !== "canceled" && status !== "incomplete_expired";
}

function isMissingStripeResource(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { statusCode?: unknown }).statusCode === 404
  );
}
