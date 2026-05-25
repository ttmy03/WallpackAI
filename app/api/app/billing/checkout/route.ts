import { NextResponse } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api-response";
import type { BillingCheckoutResponse } from "@/lib/app/api-types";
import { requireAppUser } from "@/lib/auth/api-auth";
import {
  checkoutCancelUrlFromRequest,
  checkoutSuccessUrlFromRequest,
  createStripeCheckoutSession,
  StripeCheckoutConfigurationError
} from "@/lib/billing/checkout";
import { createStripeBillingPortalSession } from "@/lib/billing/portal";
import { PAID_PLAN_KEYS } from "@/lib/billing/plans";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  planKey: z.enum(PAID_PLAN_KEYS)
});

export async function POST(request: Request) {
  const auth = await requireAppUser(request, "starting checkout");

  if (!auth.ok) {
    return auth.response;
  }

  const json: unknown = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      fail(
        "VALIDATION_ERROR",
        "Choose a paid plan before starting checkout.",
        parsed.error.flatten()
      ),
      { status: 400 }
    );
  }

  try {
    const session =
      auth.firestoreUser.stripeCustomerId &&
      auth.firestoreUser.stripeSubscriptionId
        ? await createStripeBillingPortalSession({
            stripeCustomerId: auth.firestoreUser.stripeCustomerId,
            returnUrl: checkoutSuccessUrlFromRequest(request)
          })
        : await createStripeCheckoutSession({
            planKey: parsed.data.planKey,
            user: auth.firestoreUser,
            successUrl: checkoutSuccessUrlFromRequest(request),
            cancelUrl: checkoutCancelUrlFromRequest(request)
          });

    return NextResponse.json(ok<BillingCheckoutResponse>(session));
  } catch (error) {
    const isConfigurationError =
      error instanceof StripeCheckoutConfigurationError;

    return NextResponse.json(
      fail(
        isConfigurationError
          ? "BILLING_CHECKOUT_NOT_CONFIGURED"
          : "BILLING_CHECKOUT_FAILED",
        error instanceof Error
          ? error.message
          : "Stripe Checkout could not be opened."
      ),
      { status: isConfigurationError ? 500 : 502 }
    );
  }
}
