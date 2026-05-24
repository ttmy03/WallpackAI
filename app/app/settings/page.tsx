import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export default function SettingsPage() {
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
              Listing descriptions include an AI-assisted creation sentence
              unless a seller disables it after warning.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" type="button">
              Enabled
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Billing</CardTitle>
            <CardDescription>
              Stripe Checkout and Billing Portal routes are part of the MVP
              build order.
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
