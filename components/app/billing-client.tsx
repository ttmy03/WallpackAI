"use client";

import { CreditCard, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchAuthenticatedApi } from "@/components/app/authenticated-api";
import { BillingPortalButton } from "@/components/app/billing-portal-button";
import {
  AppErrorState,
  AppLoadingState
} from "@/components/app/dashboard-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import type { UserSettings } from "@/lib/app/api-types";

export function BillingClient() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBilling() {
      try {
        const payload = await fetchAuthenticatedApi<UserSettings>(
          "/api/app/user-settings"
        );

        if (!cancelled) {
          setSettings(payload);
          setError(null);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Billing could not be loaded."
          );
        }
      }
    }

    void loadBilling();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <AppErrorState
        title="Billing could not be loaded"
        message={error}
        actionHref="/app/settings"
        actionLabel="Back to settings"
      />
    );
  }

  if (!settings) {
    return <AppLoadingState label="Loading billing..." />;
  }

  return (
    <main>
      <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">
        Billing
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-normal">
        Plan and credits
      </h1>
      <Card className="mt-8">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {settings.planLabel}
                <Sparkles className="size-4 text-primary" />
              </CardTitle>
              <CardDescription className="mt-2">
                {settings.creditBalance} credits available for preview and
                export jobs.
              </CardDescription>
            </div>
            <Badge variant="secondary">{settings.planKey}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start">
          {settings.planKey !== "free" && settings.hasStripeCustomer ? (
            <BillingPortalButton variant="default">
              Manage subscription
            </BillingPortalButton>
          ) : (
            <Button asChild>
              <Link href="/pricing">
                <CreditCard />
                View plans
              </Link>
            </Button>
          )}
          <p className="max-w-xl text-sm text-muted-foreground">
            Manage payment methods, invoices, plan changes, and cancellation in
            Stripe Billing Portal.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
