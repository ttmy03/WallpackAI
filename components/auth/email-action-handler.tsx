"use client";

import { applyActionCode } from "firebase/auth";
import { ArrowRight, CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { getFriendlyFirebaseAuthError } from "@/lib/firebase/auth-errors";
import { getSafeEmailActionRedirect } from "@/lib/firebase/email-action-redirect";
import { getFirebaseClientAuth } from "@/lib/firebase/client";

type EmailActionHandlerProps = {
  mode: string | null;
  oobCode: string | null;
  continueUrl: string | null;
};

type EmailActionState =
  | { status: "loading" }
  | { status: "success"; redirectPath: string }
  | { status: "error"; message: string };

export function EmailActionHandler({
  mode,
  oobCode,
  continueUrl
}: EmailActionHandlerProps) {
  const router = useRouter();
  const [state, setState] = useState<EmailActionState>({ status: "loading" });
  const redirectPath = useMemo(
    () =>
      typeof window === "undefined"
        ? "/app"
        : getSafeEmailActionRedirect(continueUrl, window.location.origin),
    [continueUrl]
  );

  useEffect(() => {
    let cancelled = false;

    async function handleAction() {
      await Promise.resolve();

      if (mode !== "verifyEmail") {
        setState({
          status: "error",
          message: "This email action is not supported by WallPack AI."
        });
        return;
      }

      if (!oobCode) {
        setState({
          status: "error",
          message: "The email verification link is missing its action code."
        });
        return;
      }

      try {
        const auth = getFirebaseClientAuth();
        await applyActionCode(auth, oobCode);

        if (auth.currentUser) {
          await auth.currentUser.reload();
          await auth.currentUser.getIdToken(true);
        }

        if (!cancelled) {
          setState({ status: "success", redirectPath });
          window.setTimeout(() => {
            router.replace(redirectPath);
          }, 900);
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message: getFriendlyFirebaseAuthError(error)
          });
        }
      }
    }

    void handleAction();

    return () => {
      cancelled = true;
    };
  }, [mode, oobCode, redirectPath, router]);

  if (state.status === "loading") {
    return (
      <EmailActionCard
        icon={<Loader2 className="size-5 animate-spin" />}
        title="Verifying email"
        description="One moment while Firebase confirms your email address."
      />
    );
  }

  if (state.status === "success") {
    return (
      <EmailActionCard
        icon={<CheckCircle2 className="size-5" />}
        title="Email verified"
        description="Your account is ready. You will be returned to the workspace automatically."
      >
        <Button asChild>
          <Link href={state.redirectPath}>
            Continue <ArrowRight />
          </Link>
        </Button>
      </EmailActionCard>
    );
  }

  return (
    <EmailActionCard
      icon={<TriangleAlert className="size-5" />}
      title="Verification link did not work"
      description={state.message}
      tone="error"
    >
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/app">Back to workspace</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/auth/sign-in">Sign in</Link>
        </Button>
      </div>
    </EmailActionCard>
  );
}

function EmailActionCard({
  icon,
  title,
  description,
  children,
  tone = "default"
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
  tone?: "default" | "error";
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span
            className={
              tone === "error"
                ? "grid size-10 shrink-0 place-items-center rounded-md bg-destructive text-destructive-foreground"
                : "grid size-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground"
            }
          >
            {icon}
          </span>
          <div>
            <CardTitle role="heading" aria-level={1}>
              {title}
            </CardTitle>
            <CardDescription className="mt-2">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      {children ? <CardContent>{children}</CardContent> : null}
    </Card>
  );
}
