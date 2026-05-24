export type PrintRatioPresetKey =
  | "2x3"
  | "3x4"
  | "4x5"
  | "5x7"
  | "11x14"
  | "iso-a";

export type PrintRatioPreset = {
  key: PrintRatioPresetKey;
  label: string;
  ratioWidth: number;
  ratioHeight: number;
  masterPrintWidthIn: number;
  masterPrintHeightIn: number;
  targetDpi: number;
  fileName: string;
  supportedPrintSizes: string[];
};

export const PRINT_RATIO_PRESETS = {
  "2x3": {
    key: "2x3",
    label: "2:3 Poster",
    ratioWidth: 2,
    ratioHeight: 3,
    masterPrintWidthIn: 24,
    masterPrintHeightIn: 36,
    targetDpi: 300,
    fileName: "2x3_24x36in_300dpi.jpg",
    supportedPrintSizes: ["4x6", "8x12", "12x18", "16x24", "20x30", "24x36"]
  },
  "3x4": {
    key: "3x4",
    label: "3:4 Portrait",
    ratioWidth: 3,
    ratioHeight: 4,
    masterPrintWidthIn: 18,
    masterPrintHeightIn: 24,
    targetDpi: 300,
    fileName: "3x4_18x24in_300dpi.jpg",
    supportedPrintSizes: ["6x8", "9x12", "12x16", "15x20", "18x24"]
  },
  "4x5": {
    key: "4x5",
    label: "4:5 Classic",
    ratioWidth: 4,
    ratioHeight: 5,
    masterPrintWidthIn: 16,
    masterPrintHeightIn: 20,
    targetDpi: 300,
    fileName: "4x5_16x20in_300dpi.jpg",
    supportedPrintSizes: ["4x5", "8x10", "12x15", "16x20"]
  },
  "5x7": {
    key: "5x7",
    label: "5:7 Frame",
    ratioWidth: 5,
    ratioHeight: 7,
    masterPrintWidthIn: 20,
    masterPrintHeightIn: 28,
    targetDpi: 300,
    fileName: "5x7_20x28in_300dpi.jpg",
    supportedPrintSizes: ["5x7", "10x14", "15x21", "20x28"]
  },
  "11x14": {
    key: "11x14",
    label: "11:14 Gallery",
    ratioWidth: 11,
    ratioHeight: 14,
    masterPrintWidthIn: 22,
    masterPrintHeightIn: 28,
    targetDpi: 300,
    fileName: "11x14_22x28in_300dpi.jpg",
    supportedPrintSizes: ["11x14", "22x28"]
  },
  "iso-a": {
    key: "iso-a",
    label: "A-Series",
    ratioWidth: 1,
    ratioHeight: Math.SQRT2,
    masterPrintWidthIn: 420 / 25.4,
    masterPrintHeightIn: 594 / 25.4,
    targetDpi: 300,
    fileName: "A-series_A2_300dpi.jpg",
    supportedPrintSizes: ["A5", "A4", "A3", "A2"]
  }
} as const satisfies Record<PrintRatioPresetKey, PrintRatioPreset>;

export const DEFAULT_PRINT_RATIO_KEYS: PrintRatioPresetKey[] = [
  "2x3",
  "3x4",
  "4x5",
  "5x7",
  "11x14"
];

export function getPrintRatioPreset(key: PrintRatioPresetKey) {
  return PRINT_RATIO_PRESETS[key];
}
