import type {
  EnqueueExportJobResult,
  EnqueuedGenerationJob,
  ExportJobInput,
  GenerationJobInput,
  JobRunner
} from "@/lib/jobs/job-runner";
import {
  enqueueLocalExportJob,
  processExportJob
} from "@/lib/jobs/local-export-runner";
import {
  enqueueLocalGenerationJob,
  processGenerationJob
} from "@/lib/jobs/local-generation-runner";

export class LocalJobRunner implements JobRunner {
  async enqueueGeneration(
    input: GenerationJobInput
  ): Promise<EnqueuedGenerationJob> {
    const queued = await enqueueLocalGenerationJob({
      ...input,
      promptInputs: requirePromptInputs(input)
    });

    scheduleLocalJob(() => processGenerationJob(queued.jobId));

    return queued;
  }

  async enqueueExport(input: ExportJobInput): Promise<EnqueueExportJobResult> {
    const queued = await enqueueLocalExportJob(input);

    if (queued.ok) {
      scheduleLocalJob(() => processExportJob(queued.job.jobId));
    }

    return queued;
  }
}

function scheduleLocalJob(work: () => Promise<unknown>) {
  if (process.env.LOCAL_JOB_AUTOPROCESS === "false") {
    return;
  }

  setTimeout(() => {
    void work().catch((error: unknown) => {
      console.error("Local job worker failed", error);
    });
  }, 0);
}

function requirePromptInputs(input: GenerationJobInput) {
  if (!input.promptInputs) {
    throw new Error("promptInputs are required to enqueue generation jobs.");
  }

  return input.promptInputs;
}
