import { PRINT_RATIO_PRESETS } from "@/lib/print/presets";
import { presetToPixels } from "@/lib/print/math";

export default function PrintSizesPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Print sizes
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal">
          Exact pixels before export.
        </h1>
        <p className="mt-4 text-muted-foreground">
          WallPack AI exports real image dimensions for the selected print size.
          Changing metadata alone is not treated as print-ready.
        </p>
      </div>
      <div className="mt-10 overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Ratio</th>
              <th className="px-4 py-3 font-medium">Master print size</th>
              <th className="px-4 py-3 font-medium">Pixels</th>
              <th className="px-4 py-3 font-medium">Buyer sizes</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {Object.values(PRINT_RATIO_PRESETS).map((preset) => {
              const pixels = presetToPixels(preset);

              return (
                <tr key={preset.key}>
                  <td className="px-4 py-3 font-medium">{preset.label}</td>
                  <td className="px-4 py-3">
                    {preset.masterPrintWidthIn.toFixed(2).replace(".00", "")} x{" "}
                    {preset.masterPrintHeightIn.toFixed(2).replace(".00", "")} in
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {pixels.width} x {pixels.height}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {preset.supportedPrintSizes.join(", ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
