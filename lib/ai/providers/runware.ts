import { randomUUID } from "node:crypto";

import sharp from "sharp";

import type {
  GeneratedImage,
  GenerateImageInput,
  ImageProvider
} from "@/lib/ai/image-provider";
import type {
  UpscaledImage,
  UpscaleImageInput,
  UpscaleProvider
} from "@/lib/ai/upscale-provider";
import { readImageDimensions } from "@/lib/image/dimensions";

export const RUNWARE_GPT_IMAGE_AIR_ID = "openai:gpt-image@2";
export const RUNWARE_P_IMAGE_UPSCALE_AIR_ID = "prunaai:p-image@upscale";
export const RUNWARE_P_IMAGE_UPSCALE_MAX_INPUT_PIXELS = 4_194_304;
export const RUNWARE_API_URL = "https://api.runware.ai/v1";
const DEFAULT_RUNWARE_POLL_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_RUNWARE_POLL_INTERVAL_MS = 1_500;
const DEFAULT_RUNWARE_POLL_MAX_INTERVAL_MS = 7_500;

type RunwareImageTask = {
  taskType: "imageInference";
  taskUUID: string;
  model: string;
  positivePrompt: string;
  referenceImages?: string[];
  width: number;
  height: number;
  numberResults: number;
  outputType: "URL";
  outputFormat: "JPG" | "PNG" | "WEBP";
  outputQuality: number;
  deliveryMethod: RunwareDeliveryMethod;
  includeCost: boolean;
  safety: "none" | "fast";
};

type RunwareUpscaleTask = {
  taskType: "upscale";
  taskUUID: string;
  model: string;
  inputs: {
    image: string;
  };
  targetMegapixels: number;
  outputType: "URL";
  outputFormat: "JPG" | "PNG" | "WEBP";
  outputQuality: number;
  deliveryMethod: RunwareDeliveryMethod;
  includeCost: boolean;
  settings: {
    enhanceDetails: boolean;
    realism: boolean;
  };
};

type RunwareGetResponseTask = {
  taskType: "getResponse";
  taskUUID: string;
};

type RunwareTask =
  | RunwareImageTask
  | RunwareUpscaleTask
  | RunwareGetResponseTask;

type RunwareDeliveryMethod = "sync" | "async";

type RunwareTaskStatus = "processing" | "success" | "error";

type RunwareImageOutput = {
  taskType: "imageInference" | "upscale" | "getResponse";
  taskUUID: string;
  status?: RunwareTaskStatus;
  progress?: number;
  imageUUID?: string;
  imageURL?: string;
  imageBase64Data?: string;
  imageDataURI?: string;
  seed?: number;
  NSFWContent?: boolean;
  cost?: number;
};

type RunwareImageResponse = {
  data?: RunwareImageOutput[];
  errors?: Array<{
    code?: string;
    status?: RunwareTaskStatus;
    message?: string;
    parameter?: string;
    taskUUID?: string;
  }>;
};

type RunwareRequestContext = {
  apiUrl: string;
  apiKey: string;
  fetcher: typeof fetch;
  taskUUID: string;
  expectedResults: number;
  requestKind: "image" | "upscale";
  pollTimeoutMs?: number;
  pollIntervalMs?: number;
  pollMaxIntervalMs?: number;
};

export class RunwareImageProvider implements ImageProvider {
  constructor(
    private readonly options: {
      apiKey?: string;
      apiUrl?: string;
      airId?: string;
      fetcher?: typeof fetch;
      pollTimeoutMs?: number;
      pollIntervalMs?: number;
      pollMaxIntervalMs?: number;
    } = {}
  ) {}

  async generate(input: GenerateImageInput): Promise<GeneratedImage[]> {
    const apiKey = this.options.apiKey ?? process.env.RUNWARE_API_KEY;

    if (!apiKey) {
      throw new Error(
        "RUNWARE_API_KEY is required for Runware image generation"
      );
    }

    const task = buildRunwareImageTask(input, {
      airId:
        this.options.airId ??
        process.env.RUNWARE_AIR_ID ??
        RUNWARE_GPT_IMAGE_AIR_ID
    });
    const fetcher = this.options.fetcher ?? fetch;
    const outputs = await requestRunwareTaskResults([task], {
      apiUrl:
        this.options.apiUrl ?? process.env.RUNWARE_API_URL ?? RUNWARE_API_URL,
      apiKey,
      fetcher,
      taskUUID: task.taskUUID,
      expectedResults: task.numberResults,
      requestKind: "image",
      pollTimeoutMs: this.options.pollTimeoutMs,
      pollIntervalMs: this.options.pollIntervalMs,
      pollMaxIntervalMs: this.options.pollMaxIntervalMs
    });

    if (outputs.length === 0) {
      throw new Error("Runware did not return any generated images");
    }

    return Promise.all(
      outputs.map(async (output) => {
        const bytes = await downloadRunwareImage(output, fetcher);
        const mimeType = mimeTypeFromBytes(bytes);

        return {
          bytes,
          mimeType,
          width: task.width,
          height: task.height,
          providerRequestId: output.imageUUID,
          usage: {
            taskUUID: output.taskUUID,
            generationTaskUUID: output.taskUUID,
            generationImageUUID: output.imageUUID,
            seed: output.seed,
            generationCost: output.cost,
            cost: output.cost,
            NSFWContent: output.NSFWContent,
            model: task.model
          }
        };
      })
    );
  }
}

export class RunwareUpscaleProvider implements UpscaleProvider {
  constructor(
    private readonly options: {
      apiKey?: string;
      apiUrl?: string;
      airId?: string;
      fetcher?: typeof fetch;
      pollTimeoutMs?: number;
      pollIntervalMs?: number;
      pollMaxIntervalMs?: number;
    } = {}
  ) {}

  async upscale(input: UpscaleImageInput): Promise<UpscaledImage> {
    const apiKey = this.options.apiKey ?? process.env.RUNWARE_API_KEY;

    if (!apiKey) {
      throw new Error("RUNWARE_API_KEY is required for Runware upscaling");
    }

    const inputImage = await prepareRunwareUpscaleInputImage(input);
    const task = buildRunwareUpscaleTask(
      {
        image: inputImage.image,
        sourceWidth: inputImage.width,
        sourceHeight: inputImage.height,
        outputFormat: "JPG"
      },
      {
        airId:
          this.options.airId ??
          process.env.RUNWARE_UPSCALE_AIR_ID ??
          RUNWARE_P_IMAGE_UPSCALE_AIR_ID,
        targetMegapixels:
          readUpscaleTargetMegapixels() ??
          resolveUpscaleTargetMegapixelsForTargetDimensions(input)
      }
    );
    const fetcher = this.options.fetcher ?? fetch;
    const [output] = await requestRunwareTaskResults([task], {
      apiUrl:
        this.options.apiUrl ?? process.env.RUNWARE_API_URL ?? RUNWARE_API_URL,
      apiKey,
      fetcher,
      taskUUID: task.taskUUID,
      expectedResults: 1,
      requestKind: "upscale",
      pollTimeoutMs: this.options.pollTimeoutMs,
      pollIntervalMs: this.options.pollIntervalMs,
      pollMaxIntervalMs: this.options.pollMaxIntervalMs
    });

    if (!output) {
      throw new Error("Runware upscale did not return an image");
    }

    const bytes = await downloadRunwareImage(output, fetcher);
    const dimensions =
      readImageDimensions(bytes) ??
      dimensionsFromMegapixels(
        inputImage.width,
        inputImage.height,
        task.targetMegapixels
      );

    return {
      bytes,
      mimeType: mimeTypeFromBytes(bytes),
      width: dimensions.width,
      height: dimensions.height,
      providerRequestId: output.imageUUID ?? output.taskUUID,
      usage: {
        taskUUID: output.taskUUID,
        upscaleTaskUUID: output.taskUUID,
        upscaleImageUUID: output.imageUUID,
        upscaleCost: output.cost,
        cost: output.cost,
        model: task.model,
        upscaleInputWidth: inputImage.width,
        upscaleInputHeight: inputImage.height,
        upscaleInputResized: inputImage.resized,
        upscaleTargetMegapixels: task.targetMegapixels,
        targetWidth: input.targetWidth,
        targetHeight: input.targetHeight
      }
    };
  }
}

export function buildRunwareImageTask(
  input: GenerateImageInput,
  options: {
    airId?: string;
    taskUUID?: string;
    deliveryMethod?: RunwareDeliveryMethod;
  } = {}
): RunwareImageTask {
  const dimensions = resolveRunwareDimensions(input);
  const numberResults = clampInteger(input.count, 1, 20);
  const referenceImages = sanitizeReferenceImages(input.referenceImages);

  return {
    taskType: "imageInference",
    taskUUID: options.taskUUID ?? randomUUID(),
    model: options.airId ?? RUNWARE_GPT_IMAGE_AIR_ID,
    positivePrompt: input.prompt,
    ...(referenceImages.length > 0 ? { referenceImages } : {}),
    width: dimensions.width,
    height: dimensions.height,
    numberResults,
    outputType: "URL",
    outputFormat: "JPG",
    outputQuality: 95,
    deliveryMethod: options.deliveryMethod ?? "async",
    includeCost: true,
    safety: "fast"
  };
}

function sanitizeReferenceImages(referenceImages: string[] | undefined) {
  if (!referenceImages?.length) {
    return [];
  }

  return referenceImages
    .map((image) => image.trim())
    .filter((image) => image.length > 0)
    .slice(0, 16);
}

export function buildRunwareUpscaleTask(
  input: {
    image: string;
    sourceWidth: number;
    sourceHeight: number;
    outputFormat?: "JPG" | "PNG" | "WEBP";
  },
  options: {
    airId?: string;
    taskUUID?: string;
    targetMegapixels?: number;
    deliveryMethod?: RunwareDeliveryMethod;
  } = {}
): RunwareUpscaleTask {
  return {
    taskType: "upscale",
    taskUUID: options.taskUUID ?? randomUUID(),
    model: options.airId ?? RUNWARE_P_IMAGE_UPSCALE_AIR_ID,
    inputs: {
      image: input.image
    },
    targetMegapixels:
      options.targetMegapixels ??
      resolveUpscaleTargetMegapixels(input.sourceWidth, input.sourceHeight),
    outputType: "URL",
    outputFormat: input.outputFormat ?? "JPG",
    outputQuality: 95,
    deliveryMethod: options.deliveryMethod ?? "async",
    includeCost: true,
    settings: {
      enhanceDetails: true,
      realism: true
    }
  };
}

function resolveUpscaleTargetMegapixels(
  sourceWidth: number,
  sourceHeight: number
) {
  const sourceMegapixels = (sourceWidth * sourceHeight) / 1_000_000;

  if (!Number.isFinite(sourceMegapixels) || sourceMegapixels <= 0) {
    return 8;
  }

  return clampInteger(Math.max(Math.ceil(sourceMegapixels), 8), 1, 8);
}

function readUpscaleTargetMegapixels() {
  const value = Number(process.env.RUNWARE_UPSCALE_TARGET_MEGAPIXELS);

  if (!Number.isFinite(value)) {
    return undefined;
  }

  return clampInteger(value, 1, 8);
}

function resolveUpscaleTargetMegapixelsForTargetDimensions(
  input: UpscaleImageInput
) {
  if (!input.targetWidth || !input.targetHeight) {
    return undefined;
  }

  const targetMegapixels = Math.ceil(
    (input.targetWidth * input.targetHeight) / 1_000_000
  );

  if (!Number.isFinite(targetMegapixels) || targetMegapixels <= 0) {
    return undefined;
  }

  return clampInteger(targetMegapixels, 1, 8);
}

function dimensionsFromMegapixels(
  sourceWidth: number,
  sourceHeight: number,
  targetMegapixels: number
) {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { width: sourceWidth, height: sourceHeight };
  }

  const targetPixels = targetMegapixels * 1_000_000;
  const aspectRatio = sourceWidth / sourceHeight;
  const width = Math.round(Math.sqrt(targetPixels * aspectRatio));
  const height = Math.round(width / aspectRatio);

  return { width, height };
}

async function prepareRunwareUpscaleInputImage(input: UpscaleImageInput) {
  if (isWithinMaxPixels(input, RUNWARE_P_IMAGE_UPSCALE_MAX_INPUT_PIXELS)) {
    return {
      image: runwareUpscaleImageInput(input),
      width: input.width,
      height: input.height,
      resized: false
    };
  }

  const resized = await resizeImageToMaxPixels({
    bytes: input.bytes,
    maxPixels: RUNWARE_P_IMAGE_UPSCALE_MAX_INPUT_PIXELS,
    sourceWidth: input.width,
    sourceHeight: input.height
  });

  return {
    image: imageBytesToDataUri(resized.bytes, "image/jpeg"),
    width: resized.width,
    height: resized.height,
    resized: true
  };
}

async function resizeImageToMaxPixels(input: {
  bytes: Uint8Array;
  maxPixels: number;
  sourceWidth: number;
  sourceHeight: number;
}) {
  const dimensions = capDimensionsToMaxPixels(
    {
      width: input.sourceWidth,
      height: input.sourceHeight
    },
    { maxPixels: input.maxPixels }
  );
  const bytes = await sharp(Buffer.from(input.bytes))
    .rotate()
    .resize({
      width: dimensions.width,
      height: dimensions.height,
      fit: "fill",
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: true
    })
    .flatten({ background: "#ffffff" })
    .toColorspace("srgb")
    .jpeg({ quality: 95, mozjpeg: true })
    .toBuffer();

  return {
    bytes,
    width: dimensions.width,
    height: dimensions.height
  };
}

function capDimensionsToMaxPixels(
  dimensions: { width: number; height: number },
  options: { maxPixels: number; step?: number }
) {
  if (isWithinMaxPixels(dimensions, options.maxPixels)) {
    return dimensions;
  }

  const step = options.step ?? 1;
  const scale = Math.sqrt(
    options.maxPixels / (dimensions.width * dimensions.height)
  );
  let width = Math.max(step, floorToStep(dimensions.width * scale, step));
  let height = Math.max(step, floorToStep(dimensions.height * scale, step));

  while (width * height > options.maxPixels) {
    if (width >= height) {
      width = Math.max(step, width - step);
    } else {
      height = Math.max(step, height - step);
    }
  }

  return { width, height };
}

function isWithinMaxPixels(
  dimensions: { width: number; height: number },
  maxPixels: number
) {
  return dimensions.width * dimensions.height <= maxPixels;
}

function floorToStep(value: number, step: number) {
  return Math.floor(value / step) * step;
}

function imageBytesToDataUri(
  bytes: Uint8Array,
  mimeType: UpscaleImageInput["mimeType"]
) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}

function runwareUpscaleImageInput(input: UpscaleImageInput) {
  if (input.providerImageId && isUuid(input.providerImageId)) {
    return input.providerImageId;
  }

  return imageBytesToDataUri(input.bytes, input.mimeType);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function requestRunwareTaskResults(
  tasks: RunwareTask[],
  context: RunwareRequestContext
) {
  const response = await postRunwareTasks(tasks, context);

  if (!response.ok) {
    const message = await readRunwareHttpError(response);

    if (response.status === 504) {
      try {
        return await pollRunwareTaskResults(context);
      } catch (error) {
        const pollMessage =
          error instanceof Error ? error.message : "Polling failed.";

        throw new Error(
          `Runware ${context.requestKind} request failed with HTTP 504: ${message}. Polling task ${context.taskUUID} did not return completed results: ${pollMessage}`
        );
      }
    }

    throw new Error(
      `Runware ${context.requestKind} request failed with HTTP ${response.status}: ${message}`
    );
  }

  const json = (await response.json()) as RunwareImageResponse;
  const outputs = completedRunwareOutputs(json, context);

  if (outputs.length >= context.expectedResults) {
    return outputs.slice(0, context.expectedResults);
  }

  if (json.errors?.length && !hasProcessingRunwareOutput(json, context)) {
    throw new Error(formatRunwareErrors(json.errors));
  }

  if (tasks.some(isAsyncRunwareTask)) {
    return pollRunwareTaskResults(context);
  }

  return outputs;
}

async function pollRunwareTaskResults(context: RunwareRequestContext) {
  const timeoutMs = readRunwareDurationMs(
    context.pollTimeoutMs,
    "RUNWARE_POLL_TIMEOUT_MS",
    DEFAULT_RUNWARE_POLL_TIMEOUT_MS
  );
  const maxIntervalMs = readRunwareDurationMs(
    context.pollMaxIntervalMs,
    "RUNWARE_POLL_MAX_INTERVAL_MS",
    DEFAULT_RUNWARE_POLL_MAX_INTERVAL_MS
  );
  let intervalMs = readRunwareDurationMs(
    context.pollIntervalMs,
    "RUNWARE_POLL_INTERVAL_MS",
    DEFAULT_RUNWARE_POLL_INTERVAL_MS
  );
  const startedAt = Date.now();
  let latestResponse: RunwareImageResponse | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    await delay(intervalMs);

    const response = await postRunwareTasks(
      [{ taskType: "getResponse", taskUUID: context.taskUUID }],
      context
    );

    if (!response.ok) {
      const message = await readRunwareHttpError(response);

      if (isRetryableRunwareHttpStatus(response.status)) {
        intervalMs = nextRunwarePollInterval(intervalMs, maxIntervalMs);
        continue;
      }

      throw new Error(
        `Runware ${context.requestKind} polling failed with HTTP ${response.status}: ${message}`
      );
    }

    latestResponse = (await response.json()) as RunwareImageResponse;

    const outputs = completedRunwareOutputs(latestResponse, context);

    if (outputs.length >= context.expectedResults) {
      return outputs.slice(0, context.expectedResults);
    }

    if (
      latestResponse.errors?.length &&
      !hasProcessingRunwareOutput(latestResponse, context)
    ) {
      throw new Error(formatRunwareErrors(latestResponse.errors));
    }

    intervalMs = nextRunwarePollInterval(intervalMs, maxIntervalMs);
  }

  const outputs = latestResponse
    ? completedRunwareOutputs(latestResponse, context)
    : [];

  throw new Error(
    `Runware ${context.requestKind} task ${context.taskUUID} did not finish within ${Math.round(
      timeoutMs / 1000
    )} seconds (${outputs.length}/${context.expectedResults} results ready).`
  );
}

async function postRunwareTasks(
  tasks: RunwareTask[],
  context: RunwareRequestContext
) {
  return context.fetcher(context.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${context.apiKey}`
    },
    body: JSON.stringify(tasks)
  });
}

function completedRunwareOutputs(
  response: RunwareImageResponse,
  context: Pick<RunwareRequestContext, "taskUUID">
) {
  return (response.data ?? []).filter(
    (output) =>
      output.taskUUID === context.taskUUID && isCompletedRunwareOutput(output)
  );
}

function isCompletedRunwareOutput(output: RunwareImageOutput) {
  return (
    (!output.status || output.status === "success") &&
    Boolean(output.imageURL || output.imageBase64Data || output.imageDataURI)
  );
}

function hasProcessingRunwareOutput(
  response: RunwareImageResponse,
  context: Pick<RunwareRequestContext, "taskUUID">
) {
  return (response.data ?? []).some(
    (output) =>
      output.taskUUID === context.taskUUID && output.status === "processing"
  );
}

function isAsyncRunwareTask(task: RunwareTask) {
  return "deliveryMethod" in task && task.deliveryMethod === "async";
}

function readRunwareDurationMs(
  optionValue: number | undefined,
  envName: string,
  fallback: number
) {
  if (Number.isFinite(optionValue) && Number(optionValue) > 0) {
    return Math.trunc(Number(optionValue));
  }

  const envValue = Number(process.env[envName]);

  if (Number.isFinite(envValue) && envValue > 0) {
    return Math.trunc(envValue);
  }

  return fallback;
}

function nextRunwarePollInterval(current: number, max: number) {
  return Math.min(max, Math.max(current + 1, Math.ceil(current * 1.5)));
}

function isRetryableRunwareHttpStatus(status: number) {
  return status === 429 || status >= 500;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function formatRunwareErrors(
  errors: NonNullable<RunwareImageResponse["errors"]>
) {
  return errors
    .map((error) => {
      const message = error.message ?? error.code ?? "Runware error";

      return error.parameter ? `${message} (${error.parameter})` : message;
    })
    .join("; ");
}

async function readRunwareHttpError(response: Response) {
  const text = await response.text().catch(() => "");

  if (!text) {
    return response.statusText || "Runware rejected the request.";
  }

  try {
    const json = JSON.parse(text) as RunwareImageResponse;

    if (json.errors?.length) {
      return formatRunwareErrors(json.errors);
    }
  } catch {
    // Fall through to a compact text body below.
  }

  return text.slice(0, 500);
}

export function resolveRunwareDimensions(input: {
  aspectRatio?: string;
  width?: number;
  height?: number;
}) {
  if (input.width && input.height) {
    return validateRunwareDimensions(input.width, input.height);
  }

  const dimensions = (() => {
    switch (normalizeRatio(input.aspectRatio)) {
      case "1x1":
        return { width: 2048, height: 2048 };
      case "3x4":
        return { width: 1728, height: 2304 };
      case "4x5":
        return { width: 2048, height: 2560 };
      case "5x7":
        return { width: 2048, height: 2864 };
      case "11x14":
        return { width: 2048, height: 2608 };
      case "iso-a":
        return { width: 2048, height: 2896 };
      case "3x2":
        return { width: 2496, height: 1664 };
      case "4x3":
        return { width: 2304, height: 1728 };
      case "5x4":
        return { width: 2560, height: 2048 };
      case "7x5":
        return { width: 2864, height: 2048 };
      case "14x11":
        return { width: 2608, height: 2048 };
      case "iso-a-landscape":
        return { width: 2896, height: 2048 };
      case "2x3":
      default:
        return { width: 1664, height: 2496 };
    }
  })();

  const cappedDimensions = capDimensionsToMaxPixels(dimensions, {
    maxPixels: RUNWARE_P_IMAGE_UPSCALE_MAX_INPUT_PIXELS,
    step: 16
  });

  return validateRunwareDimensions(
    cappedDimensions.width,
    cappedDimensions.height
  );
}

function validateRunwareDimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error("Runware width and height must be integers");
  }

  const totalPixels = width * height;
  const aspectRatio = width / height;

  if (width < 480 || width > 3840 || height < 480 || height > 3840) {
    throw new Error(
      "Runware GPT Image 2 width and height must be between 480 and 3840 pixels"
    );
  }

  if (width % 16 !== 0 || height % 16 !== 0) {
    throw new Error(
      "Runware GPT Image 2 width and height must use 16 px steps"
    );
  }

  if (totalPixels < 655_360 || totalPixels > 8_294_400) {
    throw new Error(
      "Runware GPT Image 2 dimensions must be between 655,360 and 8,294,400 total pixels"
    );
  }

  if (aspectRatio < 1 / 3 || aspectRatio > 3) {
    throw new Error("Runware GPT Image 2 aspect ratio must be 3:1 or narrower");
  }

  return { width, height };
}

function normalizeRatio(value?: string) {
  return value?.toLowerCase().replace(":", "x").trim();
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.trunc(value)));
}

async function downloadRunwareImage(
  output: NonNullable<RunwareImageResponse["data"]>[number],
  fetcher: typeof fetch
) {
  if (output.imageBase64Data) {
    return Buffer.from(output.imageBase64Data, "base64");
  }

  if (output.imageDataURI) {
    const [, data] = output.imageDataURI.split(",");
    return Buffer.from(data ?? "", "base64");
  }

  if (!output.imageURL) {
    throw new Error("Runware response did not include image data or imageURL");
  }

  const response = await fetcher(output.imageURL);

  if (!response.ok) {
    throw new Error(
      `Failed to download Runware image: HTTP ${response.status}`
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

function mimeTypeFromBytes(bytes: Uint8Array): GeneratedImage["mimeType"] {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) {
    return "image/png";
  }

  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/webp";
  }

  return "image/jpeg";
}
