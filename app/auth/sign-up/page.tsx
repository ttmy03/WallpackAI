import Link from "next/link";

import { FirebaseGoogleButton } from "@/components/auth/firebase-google-button";

export default function SignUpPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-md place-items-center px-4 py-12">
      <div className="w-full rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your seller workspace account with Google.
        </p>
        <FirebaseGoogleButton mode="sign-up" />
        <p className="mt-4 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="text-primary hover:underline" href="/auth/sign-in">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
