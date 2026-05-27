import { ArrowRight, Download, FileText, Images, Ruler } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { PrintPackVisual } from "@/components/marketing/print-pack-visual";
import { Button } from "@/components/ui/button";

const workflow = [
  { label: "Guided preset", icon: Images },
  { label: "Preview job", icon: Images },
  { label: "Ratio exports", icon: Ruler },
  { label: "Listing copy", icon: FileText },
  { label: "Etsy ZIPs", icon: Download }
];

export default function HomePage() {
  return (
    <main>
      <section className="relative -mt-16 min-h-[calc(100svh)] overflow-hidden bg-neutral-950 pt-16 text-white">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-60"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=2200&q=80')"
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,12,9,0.92),rgba(9,12,9,0.62),rgba(9,12,9,0.18))]" />
        <div className="relative mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.55fr)] lg:px-8">
          <div className="max-w-2xl">
            <BrandLogo size="lg" tone="inverse" />
            <h1 className="mt-5 text-5xl font-semibold leading-[1.02] tracking-normal sm:text-6xl lg:text-7xl">
              Etsy-ready printable wall art packs.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/76 sm:text-lg">
              Generate seller-focused artwork, export exact print pixels, and
              ship listing assets with AI-use disclosure built in.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/app/new">
                  Start creating <ArrowRight />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Link href="/help/print-sizes">View print sizes</Link>
              </Button>
            </div>
          </div>
          <div className="self-end pb-10 lg:pb-0">
            <PrintPackVisual />
          </div>
        </div>
      </section>

      <section className="border-b bg-background py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.5fr_1fr] lg:items-end">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Workflow
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal">
                Built around Etsy seller output.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-5">
              {workflow.map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border bg-card p-4 text-card-foreground"
                >
                  <item.icon className="size-5 text-primary" />
                  <p className="mt-4 text-sm font-medium">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-secondary/45 py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal">
              Not a generic image generator.
            </h2>
          </div>
          <div className="space-y-3 text-sm leading-6 text-muted-foreground lg:col-span-2">
            <p>
              Every default points toward a downloadable product: exact pixel
              dimensions, ratio packs, Etsy file-size limits, mockups, listing
              tags, buyer instructions, and credit-safe job execution.
            </p>
            <p>
              Presets avoid living artists, protected characters, celebrities,
              brands, and logos. Listing descriptions include AI-assisted
              creation disclosure by default.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
