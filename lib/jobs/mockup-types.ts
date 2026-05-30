import type { JobStatus } from "@/lib/jobs/job-runner";
import type { PrintRatioPresetKey } from "@/lib/print/presets";

export type MockupImageView = {
  imageId: string;
  fileName: string;
  storagePath: string;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  bytes: number;
  width: number;
  height: number;
  providerRequestId?: string;
  usage?: Record<string, unknown>;
  previewUrl?: string;
  previewUrlExpiresAt?: string;
  dataUrl?: string;
  createdAt: string;
};

export type MockupArtifactKind = "mockup_zip";

export type MockupArtifactView = {
  artifactId: string;
  kind: MockupArtifactKind;
  fileName: string;
  storagePath: string;
  contentType: string;
  bytes: number;
  downloadUrl?: string;
  downloadUrlExpiresAt?: string;
  createdAt: string;
};

export type MockupJobView = {
  jobId: string;
  projectId: string;
  projectName: string;
  artworkId: string;
  ratioKey: PrintRatioPresetKey | null;
  status: JobStatus;
  stage: string | null;
  creditCost: number;
  creditReserved: boolean;
  creditCommitted: boolean;
  creditRefunded: boolean;
  retryable: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  prompt: string;
  images: MockupImageView[];
  artifacts: MockupArtifactView[];
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  attemptCount: number;
};
