export type GenerateImageInput = {
  prompt: string;
  negativePrompt?: string;
  count: number;
  aspectRatio?: string;
  width?: number;
  height?: number;
  referenceImages?: string[];
};

export type GeneratedImage = {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
  providerRequestId?: string;
  usage?: Record<string, unknown>;
};

export interface ImageProvider {
  generate(input: GenerateImageInput): Promise<GeneratedImage[]>;
}
