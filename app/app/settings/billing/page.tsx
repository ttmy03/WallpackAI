import { CreditCard } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export default function BillingPage() {
  return (
    <main>
      <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">
        Billing
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-normal">
        Plan and credits
      </h1>
      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Free beta</CardTitle>
              <CardDescription>
                Subscription state will be synced through signed Stripe webhooks.
              </CardDescription>
            </div>
            <Badge variant="secondary">inactive</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button type="button">
            <CreditCard />
            Upgrade with Checkout
          </Button>
          <Button type="button" variant="outline">
            Open Billing Portal
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
