import { afterEach, describe, expect, it } from "vitest";

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
});
