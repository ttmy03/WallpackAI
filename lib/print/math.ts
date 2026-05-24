import {
  getPrintRatioPreset,
  type PrintRatioPreset,
  type PrintRatioPresetKey
} from "@/lib/print/presets";

export type PixelDimensions = {
  width: number;
  height: number;
};

export function inchesToPixels(inches: number, dpi: number): number {
  assertPositiveNumber(inches, "inches");
  assertPositiveNumber(dpi, "dpi");
  return Math.round(inches * dpi);
}

export function presetToPixels(preset: PrintRatioPreset): PixelDimensions {
  return {
    width: inchesToPixels(preset.masterPrintWidthIn, preset.targetDpi),
    height: inchesToPixels(preset.masterPrintHeightIn, preset.targetDpi)
  };
}

export function presetKeyToPixels(key: PrintRatioPresetKey): PixelDimensions {
  return presetToPixels(getPrintRatioPreset(key));
}

export function aspectRatio(width: number, height: number): number {
  assertPositiveNumber(width, "width");
  assertPositiveNumber(height, "height");
  return width / height;
}

export function presetAspectRatio(preset: PrintRatioPreset): number {
  return preset.ratioWidth / preset.ratioHeight;
}

export function effectiveDpi(
  pixels: PixelDimensions,
  printSizeIn: { width: number; height: number }
): number {
  assertPositiveNumber(pixels.width, "pixels.width");
  assertPositiveNumber(pixels.height, "pixels.height");
  assertPositiveNumber(printSizeIn.width, "printSizeIn.width");
  assertPositiveNumber(printSizeIn.height, "printSizeIn.height");

  return Math.floor(
    Math.min(pixels.width / printSizeIn.width, pixels.height / printSizeIn.height)
  );
}

export function matchesPresetRatio(
  pixels: PixelDimensions,
  preset: PrintRatioPreset,
  tolerance = 0.01
): boolean {
  const actual = aspectRatio(pixels.width, pixels.height);
  const expected = presetAspectRatio(preset);
  return Math.abs(actual - expected) <= tolerance;
}

export function upscaleWarning(
  sourcePixels: PixelDimensions,
  targetPixels: PixelDimensions
): "pass" | "warning" | "strong_warning" {
  const sourceLongEdge = Math.max(sourcePixels.width, sourcePixels.height);
  const targetLongEdge = Math.max(targetPixels.width, targetPixels.height);
  const factor = targetLongEdge / sourceLongEdge;

  if (factor > 3) {
    return "strong_warning";
  }

  if (factor > 2) {
    return "warning";
  }

  return "pass";
}

function assertPositiveNumber(value: number, name: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
}
