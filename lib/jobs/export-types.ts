import type { JobStatus } from "@/lib/jobs/job-runner";
import type { PrintRatioPresetKey } from "@/lib/print/presets";

export type ExportArtifactKind = "etsy_upload_zip";

export type ExportArtifactView = {
  artifactId: string;
  kind: ExportArtifactKind;
  fileName: string;
  storagePath: string;
  contentType: string;
  bytes: number;
  ratioKeys: PrintRatioPresetKey[];
  downloadUrl?: string;
  downloadUrlExpiresAt?: string;
  createdAt: string;
};

export type ExportPrintFileView = {
  ratioKey: PrintRatioPresetKey;
  fileName: string;
  width: number;
  height: number;
  bytes: number;
  quality: number;
  resizeFactor: number;
};

export type ExportJobView = {
  jobId: string;
  projectId: string;
  projectName: string;
  artworkId: string;
  status: JobStatus;
  stage: string | null;
  requestedRatioKeys: PrintRatioPresetKey[];
  creditCost: number;
  creditReserved: boolean;
  creditCommitted: boolean;
  creditRefunded: boolean;
  retryable: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  artifacts: ExportArtifactView[];
  files: ExportPrintFileView[];
  warnings: string[];
  externalDeliveryNotRecommended: boolean;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
};
