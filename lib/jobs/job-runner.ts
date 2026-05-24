export type JobStatus =
  | "queued"
  | "validating"
  | "running"
  | "processing"
  | "uploading"
  | "succeeded"
  | "failed"
  | "cancelled";

export type GenerationJobInput = {
  userId: string;
  projectId: string;
  previewCount: number;
};

export type ExportJobInput = {
  userId: string;
  projectId: string;
  artworkId: string;
};

export interface JobRunner {
  enqueueGeneration(input: GenerationJobInput): Promise<{ jobId: string }>;
  enqueueExport(input: ExportJobInput): Promise<{ jobId: string }>;
}
