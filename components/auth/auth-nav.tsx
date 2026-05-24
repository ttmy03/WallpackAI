"use client";

import { LogOut, ShieldAlert, UserCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { signOut } from "firebase/auth";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getFriendlyFirebaseAuthError } from "@/lib/firebase/auth-errors";
import { getFirebaseClientAuth } from "@/lib/firebase/client";
import { hasGoogleProvider } from "@/lib/firebase/google-auth";
import { useFirebaseAuthUser } from "@/components/auth/use-firebase-auth-user";

export function AuthNav() {
  const { state } = useFirebaseAuthUser();
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

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" className="hidden sm:inline-flex" disabled>
          Checking
        </Button>
        <Button asChild>
          <Link href="/app/new">Start creating</Link>
        </Button>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden max-w-48 truncate text-xs text-destructive sm:inline">
          {state.message}
        </span>
        <Button asChild variant="ghost" className="hidden sm:inline-flex">
          <Link href="/auth/sign-in">Sign in</Link>
        </Button>
        <Button asChild>
          <Link href="/app/new">Start creating</Link>
        </Button>
      </div>
    );
  }

  if (!state.user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" className="hidden sm:inline-flex">
          <Link href="/auth/sign-in">Sign in</Link>
        </Button>
        <Button asChild>
          <Link href="/app/new">Start creating</Link>
        </Button>
      </div>
    );
  }

  const isGoogleUser = hasGoogleProvider(state.user.providerData);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <UserCircle className="size-4 text-muted-foreground" />
        <span className="max-w-44 truncate text-sm text-muted-foreground">
          {state.user.email ?? "Signed in"}
        </span>
        <Badge variant={isGoogleUser ? "secondary" : "warning"}>
          {isGoogleUser ? "Google" : "Use Google"}
        </Badge>
      </div>
      {!isGoogleUser ? (
        <ShieldAlert className="size-4 text-accent md:hidden" aria-hidden />
      ) : (
        <UserCircle className="size-4 text-muted-foreground md:hidden" />
      )}
      {error ? (
        <span className="hidden max-w-40 truncate text-xs text-destructive lg:inline">
          {error}
        </span>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleSignOut}
        disabled={isSigningOut}
      >
        <LogOut />
        <span className="hidden sm:inline">
          {isSigningOut ? "Signing out" : "Sign out"}
        </span>
      </Button>
    </div>
  );
}
