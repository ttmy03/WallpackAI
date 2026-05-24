import { Check } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Starter",
    price: "$12",
    credits: "80 credits / month",
    features: ["Preview generation", "5-ratio Etsy packs", "Listing copy"]
  },
  {
    name: "Studio",
    price: "$29",
    credits: "260 credits / month",
    features: ["More previews", "Seller mockups", "Priority export jobs"]
  },
  {
    name: "Batch",
    price: "$79",
    credits: "900 credits / month",
    features: ["Higher daily limits", "Admin visibility", "Manual credit support"]
  }
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Pricing
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal">
          Credits for seller-ready output.
        </h1>
        <p className="mt-4 text-muted-foreground">
          Subscription and Stripe wiring are scaffolded for the MVP path. These
          plans define the product surface before checkout is connected.
        </p>
      </div>
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.name} className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold">{plan.name}</h2>
            <p className="mt-4 text-4xl font-semibold">{plan.price}</p>
            <p className="mt-2 text-sm text-muted-foreground">{plan.credits}</p>
            <ul className="mt-6 space-y-3 text-sm">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check className="size-4 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button asChild className="mt-6 w-full">
              <Link href="/app/new">Choose {plan.name}</Link>
            </Button>
          </div>
        ))}
      </div>
    </main>
  );
}
