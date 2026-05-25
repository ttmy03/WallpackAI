import Stripe from "stripe";

import { normalizePlanKey, type PlanKey } from "@/lib/billing/plans";

const STRIPE_API_VERSION = "2026-04-22.dahlia";

let stripeClient: Stripe | null = null;

export function getStripe() {
  if (stripeClient) {
    return stripeClient;
  }

  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is required for Stripe billing.");
  }

  stripeClient = new Stripe(apiKey, {
    apiVersion: STRIPE_API_VERSION,
    typescript: true
  });

  return stripeClient;
}

export function constructStripeWebhookEvent(input: {
  rawBody: string;
  signature: string | null;
}) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is required for Stripe webhooks.");
  }

  if (!input.signature) {
    throw new Error("Stripe-Signature header is required.");
  }

  return getStripe().webhooks.constructEvent(
    input.rawBody,
    input.signature,
    webhookSecret
  );
}

export function planKeyFromStripePriceId(priceId: string | null | undefined) {
  if (!priceId) {
    return "free" satisfies PlanKey;
  }

  for (const [planKey, configuredPriceId] of Object.entries(
    stripePriceIdsByPlan()
  )) {
    if (configuredPriceId && configuredPriceId === priceId) {
      return normalizePlanKey(planKey);
    }
  }

  return "free" satisfies PlanKey;
}

export function planKeyFromStripeSubscription(
  subscription: Stripe.Subscription
) {
  const matchedItem = subscription.items.data.find((item) => {
    return planKeyFromStripePriceId(item.price.id) !== "free";
  });

  return planKeyFromStripePriceId(matchedItem?.price.id);
}

export function stripeCustomerIdFromValue(
  value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
) {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
}

export function stripeSubscriptionIdFromValue(
  value: string | Stripe.Subscription | null | undefined
) {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
}

function stripePriceIdsByPlan(): Record<
  Exclude<PlanKey, "free">,
  string | undefined
> {
  return {
    starter: process.env.STRIPE_PRICE_STARTER_ID,
    studio: process.env.STRIPE_PRICE_STUDIO_ID,
    batch: process.env.STRIPE_PRICE_BATCH_ID
  };
}
