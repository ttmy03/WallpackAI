"use client";

import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFriendlyFirebaseAuthError } from "@/lib/firebase/auth-errors";
import {
  getFirebaseClientAnalytics,
  getFirebaseClientAuth
} from "@/lib/firebase/client";
import { getEmailVerificationActionCodeSettings } from "@/lib/firebase/email-verification";

type FirebaseEmailFormProps = {
  mode: "sign-in" | "sign-up";
};

export function FirebaseEmailForm({ mode }: FirebaseEmailFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const auth = getFirebaseClientAuth();

      if (mode === "sign-up") {
        const credential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        await sendEmailVerification(
          credential.user,
          getEmailVerificationActionCodeSettings(window.location.origin)
        );
        setPassword("");
        setMessage(
          "Account created. We sent a verification email; confirm it before opening the workspace."
        );
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        router.push("/app");
      }

      void getFirebaseClientAnalytics();
    } catch (caughtError) {
      setError(getFriendlyFirebaseAuthError(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="seller@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={
            mode === "sign-up" ? "new-password" : "current-password"
          }
          minLength={6}
          required
        />
      </div>
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
          {message}
        </p>
      ) : null}
      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? "Please wait"
          : mode === "sign-up"
            ? "Create account"
            : "Sign in"}
      </Button>
    </form>
  );
}
