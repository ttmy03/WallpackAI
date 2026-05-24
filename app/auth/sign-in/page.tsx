import Link from "next/link";

import { FirebaseEmailForm } from "@/components/auth/firebase-email-form";

export default function SignInPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-md place-items-center px-4 py-12">
      <div className="w-full rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use Firebase Auth to continue to your WallPack AI workspace.
        </p>
        <FirebaseEmailForm mode="sign-in" />
        <p className="mt-4 text-sm text-muted-foreground">
          New here?{" "}
          <Link className="text-primary hover:underline" href="/auth/sign-up">
            Create account
          </Link>
        </p>
      </div>
    </main>
  );
}
