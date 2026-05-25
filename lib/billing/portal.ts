import { getStripe } from "@/lib/billing/stripe";

const DEFAULT_BILLING_RETURN_PATH = "/app/settings/billing";

export async function createStripeBillingPortalSession(input: {
  stripeCustomerId: string;
  returnUrl: string;
}) {
  const session = await getStripe().billingPortal.sessions.create({
    customer: input.stripeCustomerId,
    return_url: input.returnUrl
  });

  if (!session.url) {
    throw new Error("Stripe Billing Portal did not return a session URL.");
  }

  return { url: session.url };
}

export function billingReturnUrlFromRequest(
  request: Request,
  path = DEFAULT_BILLING_RETURN_PATH
) {
  return new URL(path, appBaseUrlFromRequest(request)).toString();
}

export function appBaseUrlFromRequest(request: Request) {
  const configuredUrl = normalizedHttpOrigin(process.env.NEXT_PUBLIC_APP_URL);

  if (configuredUrl) {
    return configuredUrl;
  }

  return new URL(request.url).origin;
}

function normalizedHttpOrigin(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}
