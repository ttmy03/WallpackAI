import type Stripe from "stripe";

import { getStripe, stripePriceIdForPlan } from "@/lib/billing/stripe";
import {
  type PaidPlanKey,
  type PlanKey,
  planLabelForPlanKey
} from "@/lib/billing/plans";
import { appBaseUrlFromRequest } from "@/lib/billing/portal";

const DEFAULT_CHECKOUT_SUCCESS_PATH = "/app/settings/billing?checkout=success";
const DEFAULT_CHECKOUT_CANCEL_PATH = "/pricing?checkout=cancelled";

type CheckoutUser = {
  id: string;
  email: string | null;
  name: string | null;
  stripeCustomerId: string | null;
};

export class StripeCheckoutConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeCheckoutConfigurationError";
  }
}

export async function createStripeCheckoutSession(input: {
  planKey: PaidPlanKey;
  user: CheckoutUser;
  successUrl: string;
  cancelUrl: string;
}) {
  const metadata = checkoutMetadata(input.user.id, input.planKey);
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    submit_type: "subscribe",
    client_reference_id: input.user.id,
    customer_email: input.user.stripeCustomerId
      ? undefined
      : input.user.email ?? undefined,
    customer: input.user.stripeCustomerId ?? undefined,
    customer_update: input.user.stripeCustomerId
      ? { address: "auto", name: "auto" }
      : undefined,
    line_items: [
      {
        price: stripePriceIdForPaidPlan(input.planKey),
        quantity: 1
      }
    ],
    metadata,
    subscription_data: {
      description: `${planLabelForPlanKey(input.planKey)} subscription`,
      metadata
    },
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl
  };

  const session = await getStripe().checkout.sessions.create(params);

  if (!session.url) {
    throw new Error("Stripe Checkout did not return a session URL.");
  }

  return { url: session.url };
}

export function stripePriceIdForPaidPlan(planKey: PaidPlanKey) {
  const priceId = stripePriceIdForPlan(planKey);

  if (!priceId) {
    throw new StripeCheckoutConfigurationError(
      `Stripe price id is not configured for the ${planKey} plan.`
    );
  }

  return priceId;
}

export function checkoutSuccessUrlFromRequest(request: Request) {
  return checkoutReturnUrlFromRequest(request, DEFAULT_CHECKOUT_SUCCESS_PATH);
}

export function checkoutCancelUrlFromRequest(request: Request) {
  return checkoutReturnUrlFromRequest(request, DEFAULT_CHECKOUT_CANCEL_PATH);
}

function checkoutReturnUrlFromRequest(request: Request, path: string) {
  return new URL(path, appBaseUrlFromRequest(request)).toString();
}

function checkoutMetadata(userId: string, planKey: PlanKey) {
  return {
    firebaseUid: userId,
    userId,
    planKey
  };
}
