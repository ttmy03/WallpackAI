import { afterEach, describe, expect, it } from "vitest";

import {
  checkoutCancelUrlFromRequest,
  checkoutSuccessUrlFromRequest,
  stripePriceIdForPaidPlan,
  StripeCheckoutConfigurationError
} from "@/lib/billing/checkout";
import { billingReturnUrlFromRequest } from "@/lib/billing/portal";
import { planKeyFromStripePriceId } from "@/lib/billing/stripe";

describe("Stripe billing mapping", () => {
  const previousEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...previousEnv };
  });

  it("maps configured Stripe price ids to internal plan keys", () => {
    process.env.STRIPE_PRICE_STARTER_ID = "price_starter";
    process.env.STRIPE_PRICE_STUDIO_ID = "price_studio";
    process.env.STRIPE_PRICE_BATCH_ID = "price_batch";

    expect(planKeyFromStripePriceId("price_starter")).toBe("starter");
    expect(planKeyFromStripePriceId("price_studio")).toBe("studio");
    expect(planKeyFromStripePriceId("price_batch")).toBe("batch");
  });

  it("falls back to free when a Stripe price id is not configured", () => {
    process.env.STRIPE_PRICE_STARTER_ID = "price_starter";

    expect(planKeyFromStripePriceId("price_other")).toBe("free");
    expect(planKeyFromStripePriceId(null)).toBe("free");
  });

  it("builds Billing Portal return URLs from the configured app URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://wallpack.example";
    const request = new Request("http://localhost:3000/api/app/billing/portal");

    expect(billingReturnUrlFromRequest(request)).toBe(
      "https://wallpack.example/app/settings/billing"
    );
  });

  it("builds Checkout success and cancel URLs from the configured app URL", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://wallpack.example/app";
    const request = new Request("http://localhost:3000/api/app/billing/checkout");

    expect(checkoutSuccessUrlFromRequest(request)).toBe(
      "https://wallpack.example/app/settings/billing?checkout=success"
    );
    expect(checkoutCancelUrlFromRequest(request)).toBe(
      "https://wallpack.example/pricing?checkout=cancelled"
    );
  });

  it("loads the configured Stripe price id for a paid plan", () => {
    process.env.STRIPE_PRICE_STARTER_ID = "price_starter";

    expect(stripePriceIdForPaidPlan("starter")).toBe("price_starter");
  });

  it("fails clearly when a paid plan has no Stripe price id", () => {
    delete process.env.STRIPE_PRICE_BATCH_ID;

    expect(() => stripePriceIdForPaidPlan("batch")).toThrow(
      StripeCheckoutConfigurationError
    );
  });
});
