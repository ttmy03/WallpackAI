"use client";

import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getFriendlyFirebaseAuthError } from "@/lib/firebase/auth-errors";
import {
  getFirebaseClientAnalytics,
  getFirebaseClientAuth
} from "@/lib/firebase/client";

type FirebaseGoogleButtonProps = {
  mode: "sign-in" | "sign-up";
};

export function FirebaseGoogleButton({ mode }: FirebaseGoogleButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleGoogleAuth() {
    setError(null);
    setIsSubmitting(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      await signInWithPopup(getFirebaseClientAuth(), provider);
      void getFirebaseClientAnalytics();
      router.push("/app");
    } catch (caughtError) {
      setError(getFriendlyFirebaseAuthError(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        onClick={handleGoogleAuth}
        disabled={isSubmitting}
      >
        <span
          aria-hidden
          className="grid size-5 place-items-center rounded-full border text-sm font-semibold"
        >
          G
        </span>
        {isSubmitting
          ? "Connecting to Google"
          : mode === "sign-up"
            ? "Create account with Google"
            : "Continue with Google"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Google is the only sign-in method for WallPack AI seller accounts.
      </p>
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
