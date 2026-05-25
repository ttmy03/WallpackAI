import type { JobStatus } from "@/lib/jobs/job-runner";
import type { PrintRatioPresetKey } from "@/lib/print/presets";

export type GenerationQuality = "draft" | "standard" | "premium";
export type GeneratedArtworkMimeType =
  | "image/png"
  | "image/jpeg"
  | "image/webp";

export type GeneratedArtworkDimensionPreview = {
  ratioKey: PrintRatioPresetKey;
  dataUrl?: string;
  previewUrl?: string;
  previewUrlExpiresAt?: string;
  sourceDataUrl?: string;
  sourceStoragePath?: string;
  sourceWidth?: number;
  sourceHeight?: number;
  sourceMimeType?: GeneratedArtworkMimeType;
  sourceProviderRequestId?: string;
  printWidth: number;
  printHeight: number;
  previewWidth: number;
  previewHeight: number;
  previewStoragePath?: string;
  createdAt: string;
};

export type GeneratedArtworkPreview = {
  artworkId: string;
  dataUrl?: string;
  previewUrl?: string;
  previewUrlExpiresAt?: string;
  width: number;
  height: number;
  mimeType: GeneratedArtworkMimeType;
  providerRequestId?: string;
  sourceStoragePath: string;
  previewStoragePath?: string;
  dimensionPreviews?: GeneratedArtworkDimensionPreview[];
  createdAt: string;
};

export type GenerationJobView = {
  jobId: string;
  projectId: string;
  projectName: string;
  status: JobStatus;
  stage: string | null;
  requestedCount: number;
  creditCost: number;
  creditReserved: boolean;
  creditCommitted: boolean;
  prompt: string;
  negativePrompt: string;
  primaryRatio: string;
  quality: GenerationQuality;
  retryable: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  artworks: GeneratedArtworkPreview[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};
