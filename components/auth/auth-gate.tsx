"use client";

import { MailCheck, RefreshCw, LogOut } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { sendEmailVerification, signOut, type User } from "firebase/auth";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { getFriendlyFirebaseAuthError } from "@/lib/firebase/auth-errors";
import { getFirebaseClientAuth } from "@/lib/firebase/client";
import { getEmailVerificationActionCodeSettings } from "@/lib/firebase/email-verification";
import { useFirebaseAuthUser } from "@/components/auth/use-firebase-auth-user";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { state, refreshUser } = useFirebaseAuthUser();

  if (state.status === "loading") {
    return (
      <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        Checking sign-in status...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={1}>
            Firebase Auth is not available
          </CardTitle>
          <CardDescription>{state.message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!state.user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={1}>
            Sign in required
          </CardTitle>
          <CardDescription>
            Sign in with Firebase Auth before creating Etsy wall-art packs.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/auth/sign-in">Sign in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/auth/sign-up">Create account</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!state.user.emailVerified) {
    return (
      <EmailVerificationRequired user={state.user} onRefresh={refreshUser} />
    );
  }

  return children;
}

function EmailVerificationRequired({
  user,
  onRefresh
}: {
  user: User;
  onRefresh: () => Promise<void>;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSendVerification() {
    setMessage(null);
    setError(null);
    setIsSending(true);

    try {
      await sendEmailVerification(
        user,
        getEmailVerificationActionCodeSettings(window.location.origin)
      );
      setMessage(
        "Verification email sent. Check your inbox before continuing."
      );
    } catch (caughtError) {
      setError(getFriendlyFirebaseAuthError(caughtError));
    } finally {
      setIsSending(false);
    }
  }

  async function handleRefresh() {
    setMessage(null);
    setError(null);
    setIsRefreshing(true);

    try {
      await onRefresh();
    } catch (caughtError) {
      setError(getFriendlyFirebaseAuthError(caughtError));
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleSignOut() {
    setError(null);
    setIsSigningOut(true);

    try {
      await signOut(getFirebaseClientAuth());
    } catch (caughtError) {
      setError(getFriendlyFirebaseAuthError(caughtError));
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
            <MailCheck className="size-5" />
          </span>
          <div>
            <CardTitle role="heading" aria-level={1}>
              Verify your email
            </CardTitle>
            <CardDescription className="mt-2">
              You are signed in as {user.email ?? "this Firebase user"}, but the
              workspace opens after the email address is confirmed.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {message ? (
          <p className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={handleSendVerification}
            disabled={isSending}
          >
            <MailCheck />
            {isSending ? "Sending" : "Send email again"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw />
            {isRefreshing ? "Checking" : "I verified it"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            <LogOut />
            {isSigningOut ? "Signing out" : "Sign out"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
