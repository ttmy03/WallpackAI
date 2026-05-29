import type { GenerationQuality } from "@/lib/jobs/generation-types";
import type { ExportJobView } from "@/lib/jobs/export-types";
import { CloudTasksJobRunner } from "@/lib/jobs/cloud-tasks-runner";
import { LocalJobRunner } from "@/lib/jobs/local-job-runner";
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

export type EnqueuedGenerationJob = {
  jobId: string;
  status: JobStatus;
  projectId: string;
};

export type EnqueueJobFailure = {
  ok: false;
  code: string;
  message: string;
  status: number;
};

export type EnqueueExportJobResult =
  | { ok: true; job: ExportJobView }
  | EnqueueJobFailure;

export interface JobRunner {
  enqueueGeneration(input: GenerationJobInput): Promise<EnqueuedGenerationJob>;
  enqueueExport(input: ExportJobInput): Promise<EnqueueExportJobResult>;
}

let jobRunner: JobRunner | null = null;

export function getJobRunner(): JobRunner {
  if (jobRunner) {
    return jobRunner;
  }

  const provider = process.env.JOB_RUNNER ?? "local";

  if (provider === "local") {
    jobRunner = new LocalJobRunner();
    return jobRunner;
  }

  if (provider === "cloud-tasks") {
    jobRunner = new CloudTasksJobRunner();
    return jobRunner;
  }

  throw new Error(`Unsupported JOB_RUNNER: ${provider}`);
}
