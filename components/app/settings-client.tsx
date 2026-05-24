"use client";

import { Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchAuthenticatedApi } from "@/components/app/authenticated-api";
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
import type { UserSettings } from "@/lib/app/api-types";

export function SettingsClient() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [defaultAiDisclosure, setDefaultAiDisclosure] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
            <CardTitle>Billing</CardTitle>
            <CardDescription>
              Checkout and customer portal routes are not connected yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/app/settings/billing">Open billing</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
