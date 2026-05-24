"use client";

import { LogOut, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { signOut, type User } from "firebase/auth";

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
import { hasGoogleProvider } from "@/lib/firebase/google-auth";
import { useFirebaseAuthUser } from "@/components/auth/use-firebase-auth-user";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { state } = useFirebaseAuthUser();

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
            Continue with Google before creating Etsy wall-art packs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/auth/sign-in">Continue with Google</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!hasGoogleProvider(state.user.providerData) || !state.user.emailVerified) {
    return <GoogleAccountRequired user={state.user} />;
  }

  return children;
}

function GoogleAccountRequired({ user }: { user: User }) {
  const [error, setError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

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
            <ShieldAlert className="size-5" />
          </span>
          <div>
            <CardTitle role="heading" aria-level={1}>
              Google account required
            </CardTitle>
            <CardDescription className="mt-2">
              You are signed in as {user.email ?? "this Firebase user"}, but
              WallPack AI only accepts Google sign-in.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/auth/sign-in">Continue with Google</Link>
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
