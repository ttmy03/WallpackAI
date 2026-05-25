import { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api-response";
import type { BillingPortalResponse } from "@/lib/app/api-types";
import { requireAppUser } from "@/lib/auth/api-auth";
import {
  billingReturnUrlFromRequest,
  createStripeBillingPortalSession
} from "@/lib/billing/portal";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await requireAppUser(request, "managing billing");

  if (!auth.ok) {
    return auth.response;
  }

  if (!auth.firestoreUser.stripeCustomerId) {
    return NextResponse.json(
      fail(
        "BILLING_CUSTOMER_NOT_FOUND",
        "Start a paid subscription before opening the Billing Portal."
      ),
      { status: 400 }
    );
  }

  try {
    const session = await createStripeBillingPortalSession({
      stripeCustomerId: auth.firestoreUser.stripeCustomerId,
      returnUrl: billingReturnUrlFromRequest(request)
    });

    return NextResponse.json(ok<BillingPortalResponse>(session));
  } catch (error) {
    return NextResponse.json(
      fail(
        "BILLING_PORTAL_FAILED",
        error instanceof Error
          ? error.message
          : "The Billing Portal could not be opened."
      ),
      { status: 500 }
    );
  }
}
