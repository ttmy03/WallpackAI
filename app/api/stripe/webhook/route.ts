import { NextResponse } from "next/server";

import { constructStripeWebhookEvent } from "@/lib/billing/stripe";
import { processStripeWebhookEvent } from "@/lib/billing/stripe-webhooks";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event;

  try {
    event = constructStripeWebhookEvent({ rawBody, signature });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Stripe webhook signature verification failed."
      },
      { status: 400 }
    );
  }

  try {
    const result = await processStripeWebhookEvent(event);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Stripe webhook could not be processed."
      },
      { status: 500 }
    );
  }
}
