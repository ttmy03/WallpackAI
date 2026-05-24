import type { JobStatus } from "@/lib/jobs/job-runner";

export type GenerationQuality = "draft" | "standard" | "premium";

export type GeneratedArtworkPreview = {
  artworkId: string;
  dataUrl: string;
  width: number;
  height: number;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  providerRequestId?: string;
  sourceStoragePath: string;
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
