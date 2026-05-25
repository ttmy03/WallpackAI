import sharp from "sharp";

import type { UpscaleProvider } from "@/lib/ai/upscale-provider";
import { fitImageWithinCanvas } from "@/lib/image/fit";
import type { ExportPrintFileView } from "@/lib/jobs/export-types";
import { presetKeyToPixels } from "@/lib/print/math";
import {
  getPrintRatioPreset,
  type PrintRatioPresetKey
} from "@/lib/print/presets";

const JPEG_QUALITY_STEPS = [90, 86, 82, 78, 74] as const;
const TARGET_PRINT_FILE_BYTES = 18 * 1024 * 1024;
const PRINT_FILE_BACKGROUND = "#ffffff";
const BLURRED_BACKGROUND_SIGMA = 36;
const MEMORY_HEAVY_JPEG_ENCODER_THRESHOLD_MP = 40;
const DEFAULT_PRINT_FILE_BUILD_CONCURRENCY = 5;
const MAX_PRINT_FILE_BUILD_CONCURRENCY = 5;

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
  workingWidth: number;
  workingHeight: number;
  upscaleProvider: string;
  upscaleUsage?: Record<string, unknown>;
  quality: number;
  resizeFactor: number;
};

export type PrintSourceImage = {
  bytes: Buffer;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
};

type PreparedPrintSource = PrintSourceImage & {
  upscaleProvider: string;
  upscaleUsage?: Record<string, unknown>;
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
  ratioSources?: Partial<Record<PrintRatioPresetKey, PrintSourceImage>>;
  upscaleProvider?: UpscaleProvider | null;
  printFileConcurrency?: number;
  onFileBuilt?: (file: BuiltPrintFile) => Promise<void> | void;
}): Promise<BuildPrintFilesResult> {
  const notifyFileBuilt = createSerialFileBuiltCallback(input.onFileBuilt);
  const buildResults = await mapWithConcurrency(
    input.ratioKeys,
    getPrintFileBuildConcurrency(input.printFileConcurrency),
    async (ratioKey) => {
      return buildPrintFile({
        sourceBytes: input.sourceBytes,
        sourceMimeType: input.sourceMimeType,
        sourceWidth: input.sourceWidth,
        sourceHeight: input.sourceHeight,
        ratioKey,
        ratioSource: input.ratioSources?.[ratioKey],
        upscaleProvider: input.upscaleProvider,
        onFileBuilt: notifyFileBuilt
      });
    }
  );
  const files = buildResults.map((result) => result.file);
  const warnings = buildResults.flatMap((result) => result.warnings);

  return {
    files,
    warnings,
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    workingWidth: maxPrintFileDimension(
      files,
      "workingWidth",
      input.sourceWidth
    ),
    workingHeight: maxPrintFileDimension(
      files,
      "workingHeight",
      input.sourceHeight
    ),
    upscaleProvider: summarizeUpscaleProviders(files),
    upscaleUsage: {
      mode: "per-ratio",
      files: files.map((file) => ({
        ratioKey: file.ratioKey,
        provider: file.upscaleProvider,
        usage: file.upscaleUsage
      }))
    }
  };
}

async function buildPrintFile(input: {
  sourceBytes: Buffer;
  sourceMimeType: "image/png" | "image/jpeg" | "image/webp";
  sourceWidth: number;
  sourceHeight: number;
  ratioKey: PrintRatioPresetKey;
  ratioSource?: PrintSourceImage;
  upscaleProvider?: UpscaleProvider | null;
  onFileBuilt?: (file: BuiltPrintFile) => Promise<void> | void;
}) {
  const warnings: string[] = [];
  const preset = getPrintRatioPreset(input.ratioKey);
  const pixels = presetKeyToPixels(input.ratioKey);
  const sourceImage =
    input.ratioSource ??
    ({
      bytes: input.sourceBytes,
      mimeType: input.sourceMimeType,
      width: input.sourceWidth,
      height: input.sourceHeight
    } satisfies PrintSourceImage);
  const source = await prepareSourceForPrintFile({
    sourceBytes: sourceImage.bytes,
    sourceMimeType: sourceImage.mimeType,
    sourceWidth: sourceImage.width,
    sourceHeight: sourceImage.height,
    targetWidth: pixels.width,
    targetHeight: pixels.height,
    upscaleProvider: input.upscaleProvider
  });
  const targetPixels = {
    width: pixels.width,
    height: pixels.height
  };
  const rendered =
    printReadySourceAsRenderedJpeg(source, targetPixels) ??
    (await renderJpegWithinTarget(
      source.bytes,
      {
        width: source.width,
        height: source.height
      },
      targetPixels
    ));

  if (rendered.bytes.byteLength > TARGET_PRINT_FILE_BYTES) {
    warnings.push(
      `${preset.fileName} is above the 18 MB Etsy safety target after compression.`
    );
  }

  const file: BuiltPrintFile = {
    fileName: preset.fileName,
    bytes: rendered.bytes,
    contentType: "image/jpeg",
    kind: "print_jpg",
    ratioKey: input.ratioKey,
    width: pixels.width,
    height: pixels.height,
    workingWidth: source.width,
    workingHeight: source.height,
    upscaleProvider: source.upscaleProvider,
    upscaleUsage: source.upscaleUsage,
    quality: rendered.quality,
    resizeFactor:
      Math.max(pixels.width, pixels.height) /
      Math.max(source.width, source.height)
  };

  await input.onFileBuilt?.(file);

  return {
    file,
    warnings
  };
}

function createSerialFileBuiltCallback(
  callback?: (file: BuiltPrintFile) => Promise<void> | void
) {
  if (!callback) {
    return undefined;
  }

  let pending = Promise.resolve();

  return (file: BuiltPrintFile) => {
    // Keep progress persistence ordered while print rendering runs in parallel.
    const next = pending.then(() => callback(file));
    pending = next.catch(() => undefined);

    return next;
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

async function prepareSourceForPrintFile(input: {
  sourceBytes: Buffer;
  sourceMimeType: "image/png" | "image/jpeg" | "image/webp";
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
  upscaleProvider?: UpscaleProvider | null;
}): Promise<PreparedPrintSource> {
  if (!input.upscaleProvider) {
    const ratioSource = await renderRatioSourceImage(input);

    return {
      bytes: ratioSource.bytes,
      mimeType: ratioSource.mimeType,
      width: ratioSource.width,
      height: ratioSource.height,
      upscaleProvider: "none"
    };
  }

  const upscaleSource = await prepareSourceForProviderUpscale(input);
  const upscaled = await input.upscaleProvider.upscale({
    bytes: upscaleSource.bytes,
    mimeType: upscaleSource.mimeType,
    width: upscaleSource.width,
    height: upscaleSource.height,
    targetWidth: input.targetWidth,
    targetHeight: input.targetHeight
  });
  const metadata = await sharp(Buffer.from(upscaled.bytes)).metadata();

  return {
    bytes: Buffer.from(upscaled.bytes),
    mimeType: upscaled.mimeType,
    width: metadata.width ?? upscaled.width,
    height: metadata.height ?? upscaled.height,
    upscaleProvider:
      typeof upscaled.usage?.model === "string"
        ? upscaled.usage.model
        : "upscale",
    upscaleUsage: upscaled.usage
  };
}

async function prepareSourceForProviderUpscale(input: {
  sourceBytes: Buffer;
  sourceMimeType: "image/png" | "image/jpeg" | "image/webp";
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
}): Promise<PrintSourceImage> {
  if (matchesTargetAspectRatio(input)) {
    return {
      bytes: input.sourceBytes,
      mimeType: input.sourceMimeType,
      width: input.sourceWidth,
      height: input.sourceHeight
    };
  }

  return renderRatioSourceImage(input);
}

function printReadySourceAsRenderedJpeg(
  source: PreparedPrintSource,
  targetPixels: { width: number; height: number }
) {
  if (
    source.mimeType !== "image/jpeg" ||
    source.width !== targetPixels.width ||
    source.height !== targetPixels.height ||
    source.bytes.byteLength > TARGET_PRINT_FILE_BYTES
  ) {
    return null;
  }

  return {
    bytes: source.bytes,
    quality: 95
  };
}

async function renderRatioSourceImage(input: {
  sourceBytes: Buffer;
  sourceMimeType: "image/png" | "image/jpeg" | "image/webp";
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
}) {
  const canvas = ratioSourceCanvasSize({
    sourceWidth: input.sourceWidth,
    sourceHeight: input.sourceHeight,
    targetWidth: input.targetWidth,
    targetHeight: input.targetHeight
  });
  const rendered = await renderJpegWithinTarget(
    input.sourceBytes,
    {
      width: input.sourceWidth,
      height: input.sourceHeight
    },
    canvas
  );

  return {
    bytes: rendered.bytes,
    mimeType: "image/jpeg" as const,
    width: canvas.width,
    height: canvas.height
  };
}

function matchesTargetAspectRatio(input: {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
}) {
  const sourceAspectRatio = input.sourceWidth / input.sourceHeight;
  const targetAspectRatio = input.targetWidth / input.targetHeight;

  return Math.abs(sourceAspectRatio - targetAspectRatio) <= 0.005;
}

function ratioSourceCanvasSize(input: {
  sourceWidth: number;
  sourceHeight: number;
  targetWidth: number;
  targetHeight: number;
}) {
  const targetAspectRatio = input.targetWidth / input.targetHeight;
  const sourceLongEdge = Math.max(input.sourceWidth, input.sourceHeight);
  const width =
    targetAspectRatio >= 1
      ? sourceLongEdge
      : Math.round(sourceLongEdge * targetAspectRatio);
  const height =
    targetAspectRatio >= 1
      ? Math.round(sourceLongEdge / targetAspectRatio)
      : sourceLongEdge;

  return {
    width: Math.max(1, width),
    height: Math.max(1, height)
  };
}

function summarizeUpscaleProviders(files: BuiltPrintFile[]) {
  const providers = [...new Set(files.map((file) => file.upscaleProvider))];

  return providers.length === 1 ? providers[0] : providers.join(",");
}

function maxPrintFileDimension(
  files: BuiltPrintFile[],
  key: "workingWidth" | "workingHeight",
  fallback: number
) {
  return files.length > 0
    ? Math.max(...files.map((file) => file[key]))
    : fallback;
}

function getPrintFileBuildConcurrency(inputConcurrency?: number) {
  const envConcurrency = Number.parseInt(
    process.env.EXPORT_PRINT_FILE_CONCURRENCY ?? "",
    10
  );
  const concurrency = inputConcurrency ?? envConcurrency;

  if (!Number.isFinite(concurrency)) {
    return DEFAULT_PRINT_FILE_BUILD_CONCURRENCY;
  }

  return Math.min(
    MAX_PRINT_FILE_BUILD_CONCURRENCY,
    Math.max(1, Math.floor(concurrency))
  );
}

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<U>
) {
  const results = new Array<U>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(items.length, concurrency);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index], index);
      }
    })
  );

  return results;
}

async function renderJpegWithinTarget(
  sourceBytes: Buffer,
  sourcePixels: { width: number; height: number },
  targetPixels: { width: number; height: number }
) {
  let best: { bytes: Buffer; quality: number } | null = null;
  const frame = fitImageWithinCanvas(sourcePixels, targetPixels);

  if (fillsTargetCanvas(frame, targetPixels)) {
    return renderDirectJpegResize(sourceBytes, targetPixels);
  }

  const foreground = await sharp(sourceBytes)
    .rotate()
    .resize({
      width: frame.width,
      height: frame.height,
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false
    })
    .flatten({ background: PRINT_FILE_BACKGROUND })
    .toColorspace("srgb")
    .toBuffer();
  const background = await sharp(sourceBytes)
    .rotate()
    .resize({
      width: targetPixels.width,
      height: targetPixels.height,
      fit: "cover",
      position: "center",
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false
    })
    .flatten({ background: PRINT_FILE_BACKGROUND })
    .blur(BLURRED_BACKGROUND_SIGMA)
    .modulate({ brightness: 1.04, saturation: 1.08 })
    .toColorspace("srgb")
    .toBuffer();

  for (const quality of JPEG_QUALITY_STEPS) {
    const bytes = await sharp(background)
      .composite([{ input: foreground, left: frame.left, top: frame.top }])
      .jpeg(printJpegOptions(quality, targetPixels))
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

function fillsTargetCanvas(
  frame: { width: number; height: number; left: number; top: number },
  targetPixels: { width: number; height: number }
) {
  return (
    frame.left === 0 &&
    frame.top === 0 &&
    frame.width === targetPixels.width &&
    frame.height === targetPixels.height
  );
}

async function renderDirectJpegResize(
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
        fit: "fill",
        kernel: sharp.kernel.lanczos3,
        withoutEnlargement: false
      })
      .flatten({ background: PRINT_FILE_BACKGROUND })
      .toColorspace("srgb")
      .jpeg(printJpegOptions(quality, targetPixels))
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

function printJpegOptions(
  quality: number,
  targetPixels: { width: number; height: number }
) {
  const megapixels = (targetPixels.width * targetPixels.height) / 1_000_000;
  const useMemoryHeavyEncoder =
    megapixels <= MEMORY_HEAVY_JPEG_ENCODER_THRESHOLD_MP;

  return {
    quality,
    progressive: useMemoryHeavyEncoder,
    mozjpeg: useMemoryHeavyEncoder
  };
}
