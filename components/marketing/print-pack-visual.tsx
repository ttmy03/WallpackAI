import { CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PRINT_RATIO_PRESETS } from "@/lib/print/presets";
import { presetToPixels } from "@/lib/print/math";

export function PrintPackVisual() {
  const ratios = Object.values(PRINT_RATIO_PRESETS).slice(0, 5);

  return (
    <div className="grid gap-3 rounded-lg border border-white/20 bg-black/35 p-4 text-white shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/60">
            Etsy pack
          </p>
          <p className="mt-1 text-lg font-semibold">5 upload files planned</p>
        </div>
        <Badge variant="warning">AI disclosure ready</Badge>
      </div>
      <div className="grid gap-2">
        {ratios.map((ratio) => {
          const pixels = presetToPixels(ratio);

          return (
            <div
              key={ratio.key}
              className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-md border border-white/10 bg-white/10 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{ratio.fileName}</p>
                <p className="mt-0.5 font-mono text-xs text-white/65">
                  {pixels.width} x {pixels.height} px
                </p>
              </div>
              <CheckCircle2 className="size-4 text-emerald-200" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
