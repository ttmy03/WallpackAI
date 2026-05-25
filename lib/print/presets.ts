export type PrintRatioPresetKey =
  | "2x3"
  | "3x4"
  | "4x5"
  | "5x7"
  | "11x14"
  | "iso-a"
  | "3x2"
  | "4x3"
  | "5x4"
  | "7x5"
  | "14x11"
  | "iso-a-landscape";

export type PrintOrientation = "portrait" | "landscape";

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
  },
  "3x2": {
    key: "3x2",
    label: "3:2 Landscape",
    ratioWidth: 3,
    ratioHeight: 2,
    masterPrintWidthIn: 36,
    masterPrintHeightIn: 24,
    targetDpi: 300,
    fileName: "3x2_36x24in_300dpi.jpg",
    supportedPrintSizes: ["6x4", "12x8", "18x12", "24x16", "30x20", "36x24"]
  },
  "4x3": {
    key: "4x3",
    label: "4:3 Landscape",
    ratioWidth: 4,
    ratioHeight: 3,
    masterPrintWidthIn: 24,
    masterPrintHeightIn: 18,
    targetDpi: 300,
    fileName: "4x3_24x18in_300dpi.jpg",
    supportedPrintSizes: ["8x6", "12x9", "16x12", "20x15", "24x18"]
  },
  "5x4": {
    key: "5x4",
    label: "5:4 Landscape",
    ratioWidth: 5,
    ratioHeight: 4,
    masterPrintWidthIn: 20,
    masterPrintHeightIn: 16,
    targetDpi: 300,
    fileName: "5x4_20x16in_300dpi.jpg",
    supportedPrintSizes: ["5x4", "10x8", "15x12", "20x16"]
  },
  "7x5": {
    key: "7x5",
    label: "7:5 Landscape",
    ratioWidth: 7,
    ratioHeight: 5,
    masterPrintWidthIn: 28,
    masterPrintHeightIn: 20,
    targetDpi: 300,
    fileName: "7x5_28x20in_300dpi.jpg",
    supportedPrintSizes: ["7x5", "14x10", "21x15", "28x20"]
  },
  "14x11": {
    key: "14x11",
    label: "14:11 Landscape",
    ratioWidth: 14,
    ratioHeight: 11,
    masterPrintWidthIn: 28,
    masterPrintHeightIn: 22,
    targetDpi: 300,
    fileName: "14x11_28x22in_300dpi.jpg",
    supportedPrintSizes: ["14x11", "28x22"]
  },
  "iso-a-landscape": {
    key: "iso-a-landscape",
    label: "A-Series Landscape",
    ratioWidth: Math.SQRT2,
    ratioHeight: 1,
    masterPrintWidthIn: 594 / 25.4,
    masterPrintHeightIn: 420 / 25.4,
    targetDpi: 300,
    fileName: "A-series_A2_landscape_300dpi.jpg",
    supportedPrintSizes: ["A5", "A4", "A3", "A2"]
  }
} as const satisfies Record<PrintRatioPresetKey, PrintRatioPreset>;

export const PRINT_RATIO_PRESET_KEYS = Object.keys(
  PRINT_RATIO_PRESETS
) as PrintRatioPresetKey[];

export const PORTRAIT_PRINT_RATIO_KEYS: PrintRatioPresetKey[] = [
  "2x3",
  "3x4",
  "4x5",
  "5x7",
  "11x14"
];

export const LANDSCAPE_PRINT_RATIO_KEYS: PrintRatioPresetKey[] = [
  "3x2",
  "4x3",
  "5x4",
  "7x5",
  "14x11"
];

export const DEFAULT_PRINT_RATIO_KEYS = PORTRAIT_PRINT_RATIO_KEYS;

export const DEFAULT_PRIMARY_PRINT_RATIO_KEY_BY_ORIENTATION = {
  portrait: "2x3",
  landscape: "3x2"
} as const satisfies Record<PrintOrientation, PrintRatioPresetKey>;

export const DEFAULT_AUTOMATIC_PRINT_RATIO_KEYS = [
  ...DEFAULT_PRINT_RATIO_KEYS
] as PrintRatioPresetKey[];

export function getPrintRatioPreset(key: PrintRatioPresetKey) {
  return PRINT_RATIO_PRESETS[key];
}

export function isPrintRatioPresetKey(
  value: unknown
): value is PrintRatioPresetKey {
  return (
    typeof value === "string" &&
    PRINT_RATIO_PRESET_KEYS.includes(value as PrintRatioPresetKey)
  );
}

export function getPrintRatioOrientation(
  key: PrintRatioPresetKey
): PrintOrientation {
  const preset = getPrintRatioPreset(key);
  return preset.ratioWidth > preset.ratioHeight ? "landscape" : "portrait";
}

export function getDefaultPrimaryPrintRatioKey(
  orientation: PrintOrientation
): PrintRatioPresetKey {
  return DEFAULT_PRIMARY_PRINT_RATIO_KEY_BY_ORIENTATION[orientation];
}

export function getAutomaticPrintRatioKeys(
  orientation: PrintOrientation
): PrintRatioPresetKey[] {
  return getDefaultPrintRatioKeys(orientation);
}

export function getDefaultPrintRatioKeys(
  orientation: PrintOrientation
): PrintRatioPresetKey[] {
  const ratioKeys =
    orientation === "landscape"
      ? LANDSCAPE_PRINT_RATIO_KEYS
      : PORTRAIT_PRINT_RATIO_KEYS;

  return [...ratioKeys];
}
