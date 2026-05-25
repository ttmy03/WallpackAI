import { randomUUID } from "node:crypto";

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

export const RUNWARE_GPT_IMAGE_AIR_ID = "openai:gpt-image@2";
export const RUNWARE_P_IMAGE_UPSCALE_AIR_ID = "prunaai:p-image@upscale";
export const RUNWARE_API_URL = "https://api.runware.ai/v1";

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
  deliveryMethod: "sync";
  includeCost: boolean;
  settings: {
    enhanceDetails: boolean;
    realism: boolean;
  };
};

type RunwareImageResponse = {
  data?: Array<{
    taskType: "imageInference" | "upscale";
    taskUUID: string;
    imageUUID?: string;
    imageURL?: string;
    imageBase64Data?: string;
    imageDataURI?: string;
    seed?: number;
    NSFWContent?: boolean;
    cost?: number;
  }>;
  errors?: Array<{
    code?: string;
    message?: string;
    parameter?: string;
    taskUUID?: string;
  }>;
};

export class RunwareImageProvider implements ImageProvider {
  constructor(
    private readonly options: {
      apiKey?: string;
      apiUrl?: string;
      airId?: string;
      fetcher?: typeof fetch;
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
    const response = await fetcher(
      this.options.apiUrl ?? process.env.RUNWARE_API_URL ?? RUNWARE_API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify([task])
      }
    );

    if (!response.ok) {
      const message = await readRunwareHttpError(response);
      throw new Error(
        `Runware image request failed with HTTP ${response.status}: ${message}`
      );
    }

    const json = (await response.json()) as RunwareImageResponse;

    if (json.errors?.length) {
      throw new Error(formatRunwareErrors(json.errors));
    }

    const outputs = json.data ?? [];

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
          providerRequestId: output.imageUUID ?? output.taskUUID,
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
    } = {}
  ) {}

  async upscale(input: UpscaleImageInput): Promise<UpscaledImage> {
    const apiKey = this.options.apiKey ?? process.env.RUNWARE_API_KEY;

    if (!apiKey) {
      throw new Error("RUNWARE_API_KEY is required for Runware upscaling");
    }

    const task = buildRunwareUpscaleTask(
      {
        image: imageBytesToDataUri(input.bytes, input.mimeType),
        sourceWidth: input.width,
        sourceHeight: input.height,
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
    const response = await fetcher(
      this.options.apiUrl ?? process.env.RUNWARE_API_URL ?? RUNWARE_API_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify([task])
      }
    );

    if (!response.ok) {
      const message = await readRunwareHttpError(response);
      throw new Error(
        `Runware upscale request failed with HTTP ${response.status}: ${message}`
      );
    }

    const json = (await response.json()) as RunwareImageResponse;

    if (json.errors?.length) {
      throw new Error(formatRunwareErrors(json.errors));
    }

    const output = json.data?.[0];

    if (!output) {
      throw new Error("Runware upscale did not return an image");
    }

    const bytes = await downloadRunwareImage(output, fetcher);
    const dimensions = dimensionsFromMegapixels(
      input.width,
      input.height,
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
        upscaleTargetMegapixels: task.targetMegapixels,
        targetWidth: input.targetWidth,
        targetHeight: input.targetHeight
      }
    };
  }
}

export function buildRunwareImageTask(
  input: GenerateImageInput,
  options: { airId?: string; taskUUID?: string } = {}
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
    deliveryMethod: "sync",
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

function imageBytesToDataUri(
  bytes: Uint8Array,
  mimeType: UpscaleImageInput["mimeType"]
) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
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
