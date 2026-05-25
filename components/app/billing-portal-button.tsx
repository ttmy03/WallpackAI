"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";

import { fetchAuthenticatedApi } from "@/components/app/authenticated-api";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { BillingPortalResponse } from "@/lib/app/api-types";

type BillingPortalButtonProps = {
  disabled?: boolean;
  className?: string;
  variant?: ButtonProps["variant"];
  children?: React.ReactNode;
};

export function BillingPortalButton({
  disabled,
  className,
  variant = "outline",
  children = "Manage subscription"
}: BillingPortalButtonProps) {
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOpenPortal() {
    setIsOpening(true);
    setError(null);

    try {
      const payload = await fetchAuthenticatedApi<BillingPortalResponse>(
        "/api/app/billing/portal",
        { method: "POST" }
      );
      window.location.assign(payload.url);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Billing Portal could not be opened."
      );
    } finally {
      setIsOpening(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant}
        className={className}
        disabled={disabled || isOpening}
        onClick={() => void handleOpenPortal()}
      >
        {isOpening ? <Loader2 className="animate-spin" /> : <CreditCard />}
        {isOpening ? "Opening Portal" : children}
      </Button>
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
