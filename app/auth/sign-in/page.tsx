import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { FirebaseGoogleButton } from "@/components/auth/firebase-google-button";

export default function SignInPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-md place-items-center px-4 py-12">
      <div className="w-full rounded-lg border bg-card p-6 shadow-sm">
        <BrandLogo size="md" className="mb-6" />
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Continue with Google to open your WallPack AI workspace.
        </p>
        <FirebaseGoogleButton mode="sign-in" />
        <p className="mt-4 text-sm text-muted-foreground">
          New here?{" "}
          <Link className="text-primary hover:underline" href="/auth/sign-up">
            Create with Google
          </Link>
        </p>
      </div>
    </main>
  );
}
