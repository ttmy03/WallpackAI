import type { GenerationQuality } from "@/lib/jobs/generation-types";
import type { PrintRatioPresetKey } from "@/lib/print/presets";
import type { PromptInput } from "@/lib/prompts/schema";

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
  projectName?: string;
  previewCount: number;
  creditCost?: number;
  promptInputs?: PromptInput;
  quality?: GenerationQuality;
};

export type ExportJobInput = {
  userId: string;
  projectId: string;
  artworkId: string;
  ratioKeys?: PrintRatioPresetKey[];
};

export interface JobRunner {
  enqueueGeneration(input: GenerationJobInput): Promise<{ jobId: string }>;
  enqueueExport(input: ExportJobInput): Promise<{ jobId: string }>;
}
