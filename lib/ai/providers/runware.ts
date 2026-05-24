import { randomUUID } from "node:crypto";

import type {
  GeneratedImage,
  GenerateImageInput,
  ImageProvider
} from "@/lib/ai/image-provider";

export const RUNWARE_SEEDREAM_AIR_ID = "bytedance:seedream@4.5";
export const RUNWARE_API_URL = "https://api.runware.ai/v1";

type RunwareImageTask = {
  taskType: "imageInference";
  taskUUID: string;
  model: string;
  positivePrompt: string;
  width: number;
  height: number;
  numberResults: number;
  outputType: "URL";
  outputFormat: "JPG" | "PNG" | "WEBP";
  outputQuality: number;
  includeCost: boolean;
  safety: {
    checkContent: boolean;
  };
  providerSettings?: {
    bytedance?: {
      optimizePromptMode?: "standard" | "fast";
      maxSequentialImages?: number;
    };
  };
};

type RunwareImageResponse = {
  data?: Array<{
    taskType: "imageInference";
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
      throw new Error("RUNWARE_API_KEY is required for Runware image generation");
    }

    const task = buildRunwareImageTask(input, {
      airId:
        this.options.airId ??
        process.env.RUNWARE_AIR_ID ??
        RUNWARE_SEEDREAM_AIR_ID
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
            seed: output.seed,
            cost: output.cost,
            NSFWContent: output.NSFWContent,
            model: task.model
          }
        };
      })
    );
  }
}

export function buildRunwareImageTask(
  input: GenerateImageInput,
  options: { airId?: string; taskUUID?: string } = {}
): RunwareImageTask {
  const dimensions = resolveRunwareDimensions(input);
  const numberResults = clampInteger(input.count, 1, 20);

  return {
    taskType: "imageInference",
    taskUUID: options.taskUUID ?? randomUUID(),
    model: options.airId ?? RUNWARE_SEEDREAM_AIR_ID,
    positivePrompt: input.prompt,
    width: dimensions.width,
    height: dimensions.height,
    numberResults,
    outputType: "URL",
    outputFormat: "JPG",
    outputQuality: 95,
    includeCost: true,
    safety: {
      checkContent: true
    },
    providerSettings: {
      bytedance: {
        optimizePromptMode: "standard"
      }
    }
  };
}

function formatRunwareErrors(errors: NonNullable<RunwareImageResponse["errors"]>) {
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
      return { width: 2200, height: 2800 };
    case "iso-a":
      return { width: 2048, height: 2896 };
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

  if (totalPixels < 3_686_400 || totalPixels > 16_777_216) {
    throw new Error(
      "Runware Seedream 4.5 dimensions must be between 3,686,400 and 16,777,216 total pixels"
    );
  }

  if (aspectRatio < 1 / 16 || aspectRatio > 16) {
    throw new Error("Runware Seedream 4.5 aspect ratio must be between 1:16 and 16:1");
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
    throw new Error(`Failed to download Runware image: HTTP ${response.status}`);
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
