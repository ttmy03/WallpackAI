export type UpscaleImageInput = {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
  providerImageId?: string;
  targetWidth?: number;
  targetHeight?: number;
};

export type UpscaledImage = {
  bytes: Uint8Array;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  width: number;
  height: number;
  providerRequestId?: string;
  usage?: Record<string, unknown>;
};

export interface UpscaleProvider {
  upscale(input: UpscaleImageInput): Promise<UpscaledImage>;
}
