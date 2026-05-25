"use client";

import { CreditCard, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { fetchAuthenticatedApi } from "@/components/app/authenticated-api";
import { useFirebaseAuthUser } from "@/components/auth/use-firebase-auth-user";
import { Button } from "@/components/ui/button";
import type { BillingCheckoutResponse } from "@/lib/app/api-types";
import type { PaidPlanKey } from "@/lib/billing/plans";

type PricingPlanActionProps =
  | {
      planKey: "free";
      planName: string;
    }
  | {
      planKey: PaidPlanKey;
      planName: string;
    };

export function PricingPlanAction({
  planKey,
  planName
}: PricingPlanActionProps) {
  const { state: authState } = useFirebaseAuthUser();
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStartCheckout() {
    if (planKey === "free") {
      return;
    }

    setIsOpening(true);
    setError(null);

    try {
      const payload = await fetchAuthenticatedApi<BillingCheckoutResponse>(
        "/api/app/billing/checkout",
        {
          method: "POST",
          body: JSON.stringify({ planKey })
        }
      );
      window.location.assign(payload.url);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Stripe Checkout could not be opened."
      );
    } finally {
      setIsOpening(false);
    }
  }

  if (planKey === "free") {
    return (
      <Button asChild className="mt-6 w-full">
        <Link href="/app/new">Choose {planName}</Link>
      </Button>
    );
  }

  if (authState.status === "ready" && !authState.user) {
    return (
      <Button asChild className="mt-6 w-full">
        <Link href="/auth/sign-in">
          <CreditCard />
          Sign in to choose {planName}
        </Link>
      </Button>
    );
  }

  const authError =
    authState.status === "error" ? authState.message : null;
  const visibleError = error ?? authError;
  const isCheckingAuth = authState.status === "loading";

  return (
    <div className="mt-6 space-y-2">
      <Button
        type="button"
        className="w-full"
        disabled={isOpening || isCheckingAuth || Boolean(authError)}
        onClick={() => void handleStartCheckout()}
      >
        {isOpening ? <Loader2 className="animate-spin" /> : <CreditCard />}
        {isOpening
          ? "Opening Stripe"
          : isCheckingAuth
            ? "Checking sign-in"
            : `Choose ${planName}`}
      </Button>
      {visibleError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {visibleError}
        </p>
      ) : null}
    </div>
  );
}
