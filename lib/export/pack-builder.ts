import sharp from "sharp";

import type { UpscaleProvider } from "@/lib/ai/upscale-provider";
import type { ExportPrintFileView } from "@/lib/jobs/export-types";
import { presetKeyToPixels } from "@/lib/print/math";
import {
  getPrintRatioPreset,
  type PrintRatioPresetKey
} from "@/lib/print/presets";

const JPEG_QUALITY_STEPS = [90, 86, 82, 78, 74] as const;
const TARGET_PRINT_FILE_BYTES = 18 * 1024 * 1024;

export type BuiltExportFile = {
  fileName: string;
  bytes: Buffer;
  contentType: string;
  kind:
    | "print_jpg"
    | "buyer_pdf"
    | "listing_txt"
    | "tags_csv"
    | "manifest_json"
    | "mockup_jpg"
    | "other";
};

export type BuiltPrintFile = BuiltExportFile & {
  kind: "print_jpg";
  ratioKey: PrintRatioPresetKey;
  width: number;
  height: number;
  quality: number;
  resizeFactor: number;
};

export type BuildPrintFilesResult = {
  files: BuiltPrintFile[];
  warnings: string[];
  sourceWidth: number;
  sourceHeight: number;
  workingWidth: number;
  workingHeight: number;
  upscaleProvider: string;
  upscaleUsage?: Record<string, unknown>;
};

export async function buildPrintFiles(input: {
  sourceBytes: Buffer;
  sourceMimeType: "image/png" | "image/jpeg" | "image/webp";
  sourceWidth: number;
  sourceHeight: number;
  ratioKeys: PrintRatioPresetKey[];
  upscaleProvider?: UpscaleProvider | null;
}): Promise<BuildPrintFilesResult> {
  const warnings: string[] = [];
  const source = await normalizeSourceImage(input);
  const files: BuiltPrintFile[] = [];

  for (const ratioKey of input.ratioKeys) {
    const preset = getPrintRatioPreset(ratioKey);
    const pixels = presetKeyToPixels(ratioKey);
    const rendered = await renderJpegWithinTarget(source.bytes, {
      width: pixels.width,
      height: pixels.height
    });

    if (rendered.bytes.byteLength > TARGET_PRINT_FILE_BYTES) {
      warnings.push(
        `${preset.fileName} is above the 18 MB Etsy safety target after compression.`
      );
    }

    files.push({
      fileName: preset.fileName,
      bytes: rendered.bytes,
      contentType: "image/jpeg",
      kind: "print_jpg",
      ratioKey,
      width: pixels.width,
      height: pixels.height,
      quality: rendered.quality,
      resizeFactor:
        Math.max(pixels.width, pixels.height) /
        Math.max(source.width, source.height)
    });
  }

  return {
    files,
    warnings,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    workingWidth: source.width,
    workingHeight: source.height,
    upscaleProvider: source.upscaleProvider,
    upscaleUsage: source.upscaleUsage
  };
}

export function printFileToView(file: BuiltPrintFile): ExportPrintFileView {
  return {
    ratioKey: file.ratioKey,
    fileName: file.fileName,
    width: file.width,
    height: file.height,
    bytes: file.bytes.byteLength,
    quality: file.quality,
    resizeFactor: file.resizeFactor
  };
}

async function normalizeSourceImage(input: {
  sourceBytes: Buffer;
  sourceMimeType: "image/png" | "image/jpeg" | "image/webp";
  sourceWidth: number;
  sourceHeight: number;
  upscaleProvider?: UpscaleProvider | null;
}) {
  if (!input.upscaleProvider) {
    return {
      bytes: input.sourceBytes,
      width: input.sourceWidth,
      height: input.sourceHeight,
      upscaleProvider: "none"
    };
  }

  const upscaled = await input.upscaleProvider.upscale({
    bytes: input.sourceBytes,
    mimeType: input.sourceMimeType,
    width: input.sourceWidth,
    height: input.sourceHeight
  });
  const metadata = await sharp(Buffer.from(upscaled.bytes)).metadata();

  return {
    bytes: Buffer.from(upscaled.bytes),
    width: metadata.width ?? upscaled.width,
    height: metadata.height ?? upscaled.height,
    upscaleProvider:
      typeof upscaled.usage?.model === "string"
        ? upscaled.usage.model
        : "upscale",
    upscaleUsage: upscaled.usage
  };
}

async function renderJpegWithinTarget(
  sourceBytes: Buffer,
  targetPixels: { width: number; height: number }
) {
  let best: { bytes: Buffer; quality: number } | null = null;

  for (const quality of JPEG_QUALITY_STEPS) {
    const bytes = await sharp(sourceBytes)
      .rotate()
      .resize({
        width: targetPixels.width,
        height: targetPixels.height,
        fit: "cover",
        position: "center",
        kernel: sharp.kernel.lanczos3,
        withoutEnlargement: false
      })
      .toColorspace("srgb")
      .jpeg({
        quality,
        progressive: true,
        mozjpeg: true
      })
      .toBuffer();

    best = { bytes, quality };

    if (bytes.byteLength <= TARGET_PRINT_FILE_BYTES) {
      break;
    }
  }

  if (!best) {
    throw new Error("Print file could not be rendered.");
  }

  return best;
}
