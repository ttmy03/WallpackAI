import { describe, expect, it } from "vitest";

import { presetKeyToPixels, effectiveDpi, matchesPresetRatio } from "@/lib/print/math";
import { PRINT_RATIO_PRESETS } from "@/lib/print/presets";

describe("print math", () => {
  it.each([
    ["2x3", 7200, 10800],
    ["3x4", 5400, 7200],
    ["4x5", 4800, 6000],
    ["5x7", 6000, 8400],
    ["11x14", 6600, 8400],
    ["iso-a", 4961, 7016]
  ] as const)("calculates canonical pixels for %s", (key, width, height) => {
    expect(presetKeyToPixels(key)).toEqual({ width, height });
  });

  it("calculates effective DPI from real pixels", () => {
    expect(
      effectiveDpi({ width: 7200, height: 10800 }, { width: 24, height: 36 })
    ).toBe(300);
  });

  it("detects matching preset ratios", () => {
    expect(
      matchesPresetRatio({ width: 7200, height: 10800 }, PRINT_RATIO_PRESETS["2x3"])
    ).toBe(true);
    expect(
      matchesPresetRatio({ width: 7200, height: 7200 }, PRINT_RATIO_PRESETS["2x3"])
    ).toBe(false);
  });
});
