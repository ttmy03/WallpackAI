import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-lg place-items-center px-4 text-center">
      <div>
        <BrandLogo
          variant="mark"
          size="md"
          decorative
          className="mb-5 justify-center"
        />
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Not found
        </p>
        <h1 className="mt-3 text-3xl font-semibold">This page is not ready.</h1>
        <p className="mt-3 text-muted-foreground">
          Return to the WallPack AI workspace.
        </p>
        <Button asChild className="mt-6">
          <Link href="/app">Open dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
