import type { CloudTasksClient } from "@google-cloud/tasks";

import type {
  EnqueueExportJobResult,
  EnqueuedGenerationJob,
  ExportJobInput,
  GenerationJobInput,
  JobRunner
} from "@/lib/jobs/job-runner";
import { enqueueLocalExportJob } from "@/lib/jobs/local-export-runner";
import { enqueueLocalGenerationJob } from "@/lib/jobs/local-generation-runner";

type JobKind = "generation" | "export";

let cloudTasksClient: CloudTasksClient | null = null;

export class CloudTasksJobRunner implements JobRunner {
  async enqueueGeneration(
    input: GenerationJobInput
  ): Promise<EnqueuedGenerationJob> {
    const queued = await enqueueLocalGenerationJob({
      ...input,
      promptInputs: requirePromptInputs(input)
    });

    await enqueueCloudTask("generation", queued.jobId);

    return queued;
  }

  async enqueueExport(input: ExportJobInput): Promise<EnqueueExportJobResult> {
    const queued = await enqueueLocalExportJob(input);

    if (queued.ok) {
      await enqueueCloudTask("export", queued.job.jobId);
    }

    return queued;
  }
}

async function enqueueCloudTask(kind: JobKind, jobId: string) {
  const client = await getCloudTasksClient();
  const projectId = requiredEnv(
    "CLOUD_TASKS_PROJECT_ID",
    process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
  const location = requiredEnv("CLOUD_TASKS_LOCATION");
  const queue = requiredEnv("CLOUD_TASKS_QUEUE");
  const parent = client.queuePath(projectId, location, queue);
  const taskName = client.taskPath(
    projectId,
    location,
    queue,
    cloudTaskIdFor(kind, jobId)
  );
  const url = `${requiredEnv("JOB_WORKER_BASE_URL").replace(/\/$/, "")}/api/internal/jobs/${kind}/${encodeURIComponent(jobId)}`;
  const secret = requiredEnv("JOB_WORKER_SECRET");

  try {
    await client.createTask({
      parent,
      task: {
        name: taskName,
        dispatchDeadline: {
          seconds: dispatchDeadlineSecondsFor(kind)
        },
        httpRequest: {
          httpMethod: "POST",
          url,
          headers: {
            "Content-Type": "application/json",
            "X-WallPack-Job-Secret": secret
          },
          body: Buffer.from(JSON.stringify({ jobId, kind })).toString("base64")
        }
      }
    });
  } catch (error) {
    if (isAlreadyExistsError(error)) {
      return;
    }

    throw error;
  }
}

async function getCloudTasksClient() {
  if (cloudTasksClient) {
    return cloudTasksClient;
  }

  const tasksModule = await import("@google-cloud/tasks");
  cloudTasksClient = new tasksModule.CloudTasksClient();

  return cloudTasksClient;
}

function cloudTaskIdFor(kind: JobKind, jobId: string) {
  return `${kind}-${jobId}`.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 500);
}

function dispatchDeadlineSecondsFor(kind: JobKind) {
  const timeoutMs =
    kind === "generation"
      ? readPositiveIntegerEnv("GENERATION_JOB_TIMEOUT_MS", 25 * 60 * 1000)
      : readPositiveIntegerEnv("EXPORT_JOB_TIMEOUT_MS", 15 * 60 * 1000);

  return Math.min(30 * 60, Math.max(15, Math.ceil(timeoutMs / 1000) + 30));
}

function requirePromptInputs(input: GenerationJobInput) {
  if (!input.promptInputs) {
    throw new Error("promptInputs are required to enqueue generation jobs.");
  }

  return input.promptInputs;
}

function requiredEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`${name} is required when JOB_RUNNER=cloud-tasks.`);
  }

  return value;
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function isAlreadyExistsError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : null;
  const message = error instanceof Error ? error.message : "";

  return code === 6 || message.includes("ALREADY_EXISTS");
}
