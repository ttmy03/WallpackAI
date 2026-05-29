import { getFirestoreProjectForUser } from "@/lib/firestore/projects";
import { getJobRunner } from "@/lib/jobs/job-runner";
import { getLocalExportJobForUser } from "@/lib/jobs/local-export-runner";
import { getLocalGenerationJobForUser } from "@/lib/jobs/local-generation-runner";

export async function retryGenerationJob(jobId: string, userId: string) {
  const job = await getLocalGenerationJobForUser(jobId, userId);

  if (!job) {
    return {
      ok: false as const,
      code: "GENERATION_JOB_NOT_FOUND",
      message: "Generation job was not found.",
      status: 404
    };
  }

  if (job.status !== "failed" || !job.retryable) {
    return {
      ok: false as const,
      code: "RETRY_NOT_ALLOWED",
      message: "Only failed retryable generation jobs can be retried.",
      status: 409
    };
  }

  const project = await getFirestoreProjectForUser(userId, job.projectId);

  if (!project) {
    return {
      ok: false as const,
      code: "PROJECT_NOT_FOUND",
      message: "Project was not found for this account.",
      status: 404
    };
  }

  const queued = await getJobRunner().enqueueGeneration({
    userId,
    projectId: project.id,
    projectName: project.name,
    promptInputs: project.promptInputs,
    previewCount: job.requestedCount,
    quality: job.quality
  });

  return { ok: true as const, job: queued };
}

export async function retryExportJob(jobId: string, userId: string) {
  const job = await getLocalExportJobForUser(jobId, userId);

  if (!job) {
    return {
      ok: false as const,
      code: "EXPORT_JOB_NOT_FOUND",
      message: "Export job was not found.",
      status: 404
    };
  }

  if (job.status !== "failed" || !job.retryable) {
    return {
      ok: false as const,
      code: "RETRY_NOT_ALLOWED",
      message: "Only failed retryable export jobs can be retried.",
      status: 409
    };
  }

  return getJobRunner().enqueueExport({
    userId,
    projectId: job.projectId,
    artworkId: job.artworkId,
    ratioKeys: job.requestedRatioKeys
  });
}
