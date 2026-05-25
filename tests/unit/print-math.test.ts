import { describe, expect, it } from "vitest";

import {
  presetKeyToPixels,
  effectiveDpi,
  matchesPresetRatio
} from "@/lib/print/math";
import {
  getAutomaticPrintRatioKeys,
  getDefaultPrintRatioKeys,
  PRINT_RATIO_PRESETS
} from "@/lib/print/presets";

describe("print math", () => {
  it.each([
    ["2x3", 7200, 10800],
    ["3x4", 5400, 7200],
    ["4x5", 4800, 6000],
    ["5x7", 6000, 8400],
    ["11x14", 6600, 8400],
    ["iso-a", 4961, 7016],
    ["3x2", 10800, 7200],
    ["4x3", 7200, 5400],
    ["5x4", 6000, 4800],
    ["7x5", 8400, 6000],
    ["14x11", 8400, 6600],
    ["iso-a-landscape", 7016, 4961]
  ] as const)("calculates canonical pixels for %s", (key, width, height) => {
    expect(presetKeyToPixels(key)).toEqual({ width, height });
  });

  it("keeps default Etsy pack ratios capped at five files per orientation", () => {
    expect(getDefaultPrintRatioKeys("portrait")).toHaveLength(5);
    expect(getDefaultPrintRatioKeys("landscape")).toHaveLength(5);
    expect(getDefaultPrintRatioKeys("landscape")).toEqual([
      "3x2",
      "4x3",
      "5x4",
      "7x5",
      "14x11"
    ]);
  });

  it("uses automatic five-ratio Etsy packs per project orientation", () => {
    expect(getAutomaticPrintRatioKeys("portrait")).toEqual([
      "2x3",
      "3x4",
      "4x5",
      "5x7",
      "11x14"
    ]);
    expect(getAutomaticPrintRatioKeys("landscape")).toEqual([
      "3x2",
      "4x3",
      "5x4",
      "7x5",
      "14x11"
    ]);
  });

  it("calculates effective DPI from real pixels", () => {
    expect(
      effectiveDpi({ width: 7200, height: 10800 }, { width: 24, height: 36 })
    ).toBe(300);
  });

  it("detects matching preset ratios", () => {
    expect(
      matchesPresetRatio(
        { width: 7200, height: 10800 },
        PRINT_RATIO_PRESETS["2x3"]
      )
    ).toBe(true);
    expect(
      matchesPresetRatio(
        { width: 7200, height: 7200 },
        PRINT_RATIO_PRESETS["2x3"]
      )
    ).toBe(false);
    expect(
      matchesPresetRatio(
        { width: 10800, height: 7200 },
        PRINT_RATIO_PRESETS["3x2"]
      )
    ).toBe(true);
  });
});
