import { RotateCcw, Sparkles, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { DEFAULT_PRINT_RATIO_KEYS, PRINT_RATIO_PRESETS } from "@/lib/print/presets";
import { presetKeyToPixels } from "@/lib/print/math";

export default async function ProjectEditorPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Project editor
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            {id === "demo-botanical" ? "Boho Botanical Trio" : "Japandi Mountain Set"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <RotateCcw />
            Retry
          </Button>
          <Button>
            <Sparkles />
            Create Etsy Pack
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Artwork</CardTitle>
            <CardDescription>Generated previews</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[1, 2, 3].map((item) => (
              <button
                key={item}
                className="aspect-[4/5] rounded-md border bg-[linear-gradient(135deg,#d9c7aa,#f4efe6_48%,#58755a)] text-left transition hover:ring-2 hover:ring-ring"
                type="button"
                aria-label={`Artwork preview ${item}`}
              />
            ))}
          </CardContent>
        </Card>

        <section className="min-w-0 rounded-lg border bg-card p-4">
          <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-[linear-gradient(150deg,#efe3ce,#c6d2bd_42%,#344633)]">
            <div className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-lg" />
            <div className="absolute bottom-4 left-4 rounded-md bg-black/50 px-3 py-2 text-sm text-white backdrop-blur">
              Focal point centered
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Dragging focal point and persisted crop settings are next. The export
            service will crop from this point into exact ratio pixels.
          </p>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Ratio previews</CardTitle>
            <CardDescription>Exact target dimensions before export</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {DEFAULT_PRINT_RATIO_KEYS.map((key) => {
              const preset = PRINT_RATIO_PRESETS[key];
              const pixels = presetKeyToPixels(key);

              return (
                <div key={key} className="rounded-md border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{preset.label}</p>
                    <Badge variant="secondary">{key}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {preset.masterPrintWidthIn} x {preset.masterPrintHeightIn} in
                    @ 300 DPI
                  </p>
                  <p className="mt-1 font-mono text-sm">
                    {pixels.width} x {pixels.height} px
                  </p>
                </div>
              );
            })}
            <div className="rounded-md border border-accent/40 bg-accent/10 p-4 text-sm">
              <div className="flex gap-2">
                <XCircle className="mt-0.5 size-4 shrink-0 text-accent" />
                <p>
                  File-size estimates and Etsy ZIP warnings appear before export.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
