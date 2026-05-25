"use client";

import { CreditCard, Loader2, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "firebase/auth";

import { fetchAuthenticatedApi } from "@/components/app/authenticated-api";
import { BillingPortalButton } from "@/components/app/billing-portal-button";
import {
  AppErrorState,
  AppLoadingState
} from "@/components/app/dashboard-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DeleteAccountResponse, UserSettings } from "@/lib/app/api-types";
import { getFirebaseClientAuth } from "@/lib/firebase/client";

export function SettingsClient() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [defaultAiDisclosure, setDefaultAiDisclosure] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const payload = await fetchAuthenticatedApi<UserSettings>(
          "/api/app/user-settings"
        );

        if (!cancelled) {
          setSettings(payload);
          setDefaultAiDisclosure(payload.defaultAiDisclosure);
          setError(null);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Settings could not be loaded."
          );
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    try {
      const saved = await fetchAuthenticatedApi<UserSettings>(
        "/api/app/user-settings",
        {
          method: "PATCH",
          body: JSON.stringify({ defaultAiDisclosure })
        }
      );
      setSettings(saved);
      setDefaultAiDisclosure(saved.defaultAiDisclosure);
      setMessage("Settings saved.");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Settings could not be saved."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await fetchAuthenticatedApi<DeleteAccountResponse>("/api/app/account", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: deleteConfirmation })
      });
      await signOut(getFirebaseClientAuth()).catch(() => undefined);
      window.location.assign("/");
    } catch (caughtError) {
      setDeleteError(
        caughtError instanceof Error
          ? caughtError.message
          : "Account could not be deleted."
      );
      setIsDeleting(false);
    }
  }

  if (error && !settings) {
    return (
      <AppErrorState
        title="Settings could not be loaded"
        message={error}
        actionHref="/app"
        actionLabel="Back to dashboard"
      />
    );
  }

  if (!settings) {
    return <AppLoadingState label="Loading settings..." />;
  }

  return (
    <main>
      <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">
        Settings
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-normal">
        Account settings
      </h1>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AI disclosure default</CardTitle>
            <CardDescription>
              Listing descriptions include an AI-assisted creation sentence by
              default.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-4"
                checked={defaultAiDisclosure}
                onChange={(event) =>
                  setDefaultAiDisclosure(event.currentTarget.checked)
                }
              />
              <span>
                Include AI disclosure in generated Etsy listing descriptions.
              </span>
            </label>
            {!defaultAiDisclosure ? (
              <p className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
                Disabling this can make Etsy listing review harder. Re-enable it
                before export unless you have your own disclosure copy.
              </p>
            ) : null}
            {error ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="rounded-md border bg-secondary px-3 py-2 text-sm">
                {message}
              </p>
            ) : null}
            <Button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave()}
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
              Save settings
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Subscription</CardTitle>
            <CardDescription>
              Manage the plan used for Etsy pack exports and monthly credits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-background px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{settings.planLabel}</span>
                <span className="text-muted-foreground">
                  {settings.creditBalance} credits
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
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
              <Button asChild variant="outline">
                <Link href="/app/settings/billing">Open billing</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/40 lg:col-span-2">
          <CardHeader>
            <CardTitle>Delete account</CardTitle>
            <CardDescription>
              Permanently remove your account, projects, generated artwork,
              exports, and Firebase sign-in. Any stored Stripe subscription is
              cancelled before deletion.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:max-w-sm">
              <label
                className="text-sm font-medium"
                htmlFor="delete-confirmation"
              >
                Type DELETE to confirm.
              </label>
              <Input
                id="delete-confirmation"
                value={deleteConfirmation}
                onChange={(event) =>
                  setDeleteConfirmation(event.currentTarget.value)
                }
                autoComplete="off"
              />
            </div>
            {deleteError ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {deleteError}
              </p>
            ) : null}
            <Button
              type="button"
              variant="destructive"
              disabled={deleteConfirmation !== "DELETE" || isDeleting}
              onClick={() => void handleDeleteAccount()}
            >
              {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete account
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
