import { randomUUID } from "node:crypto";

import { getUpscaleProvider } from "@/lib/ai/upscale";
import { InsufficientCreditsError } from "@/lib/billing/credit-ledger";
import {
  buildPrintFiles,
  type BuiltExportFile,
  type BuiltPrintFile,
  printFileToView
} from "@/lib/export/pack-builder";
import { createZipArchive } from "@/lib/export/zip";
import { partitionEtsyUploadFiles } from "@/lib/etsy/file-partition";
import { createListingCopy } from "@/lib/etsy/listing-copy";
import {
  getFirestoreExportJobForUser,
  saveFirestoreExportJob
} from "@/lib/firestore/export-jobs";
import { listFirestoreArtworksForProject } from "@/lib/firestore/generation-jobs";
import {
  getFirestoreProjectForUser,
  type FirestoreProject
} from "@/lib/firestore/projects";
import type { GeneratedArtworkPreview } from "@/lib/jobs/generation-types";
import type {
  ExportArtifactView,
  ExportJobView
} from "@/lib/jobs/export-types";
import type { JobStatus } from "@/lib/jobs/job-runner";
import {
  commitLocalCredits,
  getLocalArtworkForUser,
  refundLocalCredits,
  reserveLocalCredits
} from "@/lib/jobs/local-generation-runner";
import { sanitizeFilename } from "@/lib/print/filenames";
import {
  getDefaultPrintRatioKeys,
  getPrintRatioOrientation,
  type PrintRatioPresetKey
} from "@/lib/print/presets";
import { STYLE_PRESETS } from "@/lib/prompts/presets";
import { getStorageProvider } from "@/lib/storage";

type LocalExportJob = {
  id: string;
  userId: string;
  projectId: string;
  projectName: string;
  artworkId: string;
  status: JobStatus;
  stage: string | null;
  requestedRatioKeys: PrintRatioPresetKey[];
  creditCost: number;
  creditReserved: boolean;
  creditCommitted: boolean;
  retryable: boolean;
  errorCode: string | null;
  errorMessage: string | null;
  artifacts: ExportArtifactView[];
  files: ExportJobView["files"];
  warnings: string[];
  externalDeliveryNotRecommended: boolean;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
};

type LocalExportState = {
  jobs: Map<string, LocalExportJob>;
};

type EnqueueLocalExportInput = {
  userId: string;
  projectId: string;
  artworkId: string;
  ratioKeys?: PrintRatioPresetKey[];
};

type GlobalWithLocalExportState = typeof globalThis & {
  __wallpackLocalExportState?: LocalExportState;
};

const EXPORT_CREDIT_COST = 5;
const TERMINAL_STATUSES = new Set<JobStatus>([
  "succeeded",
  "failed",
  "cancelled"
]);

const globalWithState = globalThis as GlobalWithLocalExportState;
const state =
  globalWithState.__wallpackLocalExportState ??
  (globalWithState.__wallpackLocalExportState = {
    jobs: new Map<string, LocalExportJob>()
  });

export async function enqueueLocalExportJob(input: EnqueueLocalExportInput) {
  const project = await getFirestoreProjectForUser(
    input.userId,
    input.projectId
  );

  if (!project) {
    return {
      ok: false as const,
      code: "PROJECT_NOT_FOUND",
      message: "Project was not found for this account.",
      status: 404
    };
  }

  const artwork = await getArtworkForExport({
    userId: input.userId,
    projectId: project.id,
    artworkId: input.artworkId
  });

  if (!artwork) {
    return {
      ok: false as const,
      code: "ARTWORK_NOT_FOUND",
      message: "Artwork was not found for this project.",
      status: 404
    };
  }

  const requestedRatioKeys =
    input.ratioKeys?.length === 0 || !input.ratioKeys
      ? getDefaultPrintRatioKeys(
          getPrintRatioOrientation(project.promptInputs.primaryRatio)
        )
      : input.ratioKeys;
  const job: LocalExportJob = {
    id: `exp_${randomUUID()}`,
    userId: input.userId,
    projectId: project.id,
    projectName: project.name,
    artworkId: artwork.artworkId,
    status: "queued",
    stage: "queued",
    requestedRatioKeys,
    creditCost: EXPORT_CREDIT_COST,
    creditReserved: false,
    creditCommitted: false,
    retryable: false,
    errorCode: null,
    errorMessage: null,
    artifacts: [],
    files: [],
    warnings: [],
    externalDeliveryNotRecommended: false,
    createdAt: new Date(),
    startedAt: null,
    completedAt: null
  };

  state.jobs.set(job.id, job);
  await persistExportJob(job);

  setTimeout(() => {
    void processLocalExportJob(job.id);
  }, 0);

  return { ok: true as const, job: toExportJobView(job) };
}

export async function getLocalExportJobForUser(jobId: string, userId: string) {
  const job = state.jobs.get(jobId);

  if (job?.userId === userId) {
    return toExportJobView(job);
  }

  return getFirestoreExportJobForUser(jobId, userId);
}

export async function retryLocalExportJob(jobId: string, userId: string) {
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

  return enqueueLocalExportJob({
    userId,
    projectId: job.projectId,
    artworkId: job.artworkId,
    ratioKeys: job.requestedRatioKeys
  });
}

export async function waitForLocalExportJob(
  jobId: string,
  options: { timeoutMs?: number; intervalMs?: number } = {}
) {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const intervalMs = options.intervalMs ?? 100;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const job = state.jobs.get(jobId);

    if (job && TERMINAL_STATUSES.has(job.status)) {
      return toExportJobView(job);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for export job ${jobId}`);
}

async function processLocalExportJob(jobId: string) {
  const job = state.jobs.get(jobId);

  if (!job || job.status !== "queued") {
    return;
  }

  job.status = "validating";
  job.stage = "credit_reservation";
  job.startedAt = new Date();
  await persistExportJob(job);

  try {
    await reserveLocalCredits({
      userId: job.userId,
      amount: job.creditCost,
      reason: "Etsy pack export",
      idempotencyKey: `${job.id}:reserve`,
      relatedJobId: job.id
    });
    job.creditReserved = true;
    await persistExportJob(job);

    job.status = "running";
    job.stage = "source_download";
    await persistExportJob(job);

    const project = await getRequiredProject(job);
    const artwork = await getRequiredArtwork(job);
    const source = await loadArtworkSource(artwork);

    job.stage = "preparing_print_files";
    await persistExportJob(job);

    const printResult = await buildPrintFiles({
      sourceBytes: source.bytes,
      sourceMimeType: source.mimeType,
      sourceWidth: artwork.width,
      sourceHeight: artwork.height,
      ratioKeys: job.requestedRatioKeys,
      upscaleProvider: getUpscaleProvider()
    });

    job.status = "processing";
    job.stage = "zip_packaging";
    job.files = printResult.files.map(printFileToView);
    job.warnings = [...printResult.warnings];
    await persistExportJob(job);

    const supportFiles = buildSupportFiles({
      project,
      job,
      printFiles: printResult.files,
      printBuild: printResult
    });
    const allFiles = [...printResult.files, ...supportFiles];
    const partition = partitionEtsyUploadFiles(
      allFiles.map((file) => ({
        fileName: file.fileName,
        bytes: file.bytes.byteLength,
        kind: file.kind
      })),
      {
        uploadNamePrefix: sanitizeFilename(
          `${project.name}_WallPackAI`,
          "WallPackAI_PrintFiles"
        )
      }
    );

    job.warnings = [...job.warnings, ...partition.warnings];
    job.externalDeliveryNotRecommended =
      partition.externalDeliveryNotRecommended;
    job.status = "uploading";
    job.stage = "storage_upload";
    await persistExportJob(job);

    job.artifacts = await uploadPartitionedZips({
      userId: job.userId,
      projectId: job.projectId,
      jobId: job.id,
      allFiles,
      printFiles: printResult.files,
      uploadPartitions: partition.uploads
    });
    job.warnings = [...job.warnings, ...artifactSizeWarnings(job.artifacts)];

    await commitLocalCredits({
      userId: job.userId,
      reason: "Etsy pack export succeeded",
      idempotencyKey: `${job.id}:commit`,
      relatedJobId: job.id
    });
    job.creditCommitted = true;
    job.status = "succeeded";
    job.stage = "complete";
    job.completedAt = new Date();
    await persistExportJob(job);
  } catch (error) {
    if (job.creditReserved && !job.creditCommitted) {
      await refundLocalCredits({
        userId: job.userId,
        amount: job.creditCost,
        reason: "Etsy pack export failed",
        idempotencyKey: `${job.id}:refund`,
        relatedJobId: job.id
      });
    }

    job.status = "failed";
    job.stage = "failed";
    job.errorCode =
      error instanceof InsufficientCreditsError
        ? "INSUFFICIENT_CREDITS"
        : "EXPORT_FAILED";
    job.errorMessage =
      error instanceof Error ? error.message : "Export failed unexpectedly.";
    job.retryable = !(error instanceof InsufficientCreditsError);
    job.completedAt = new Date();
    await persistExportJob(job).catch(() => undefined);
  }
}

async function getRequiredProject(job: LocalExportJob) {
  const project = await getFirestoreProjectForUser(job.userId, job.projectId);

  if (!project) {
    throw new Error("Project was not found for this account.");
  }

  return project;
}

async function getRequiredArtwork(job: LocalExportJob) {
  const artwork = await getArtworkForExport({
    userId: job.userId,
    projectId: job.projectId,
    artworkId: job.artworkId
  });

  if (!artwork) {
    throw new Error("Artwork was not found for this project.");
  }

  return artwork;
}

async function getArtworkForExport(input: {
  userId: string;
  projectId: string;
  artworkId: string;
}) {
  const localArtwork = getLocalArtworkForUser(input);

  if (localArtwork) {
    return localArtwork;
  }

  const artworks = await listFirestoreArtworksForProject(
    input.userId,
    input.projectId
  );

  return (
    artworks.find((artwork) => artwork.artworkId === input.artworkId) ?? null
  );
}

async function loadArtworkSource(artwork: GeneratedArtworkPreview) {
  if (artwork.dataUrl) {
    return dataUrlToSource(artwork.dataUrl);
  }

  if (!artwork.sourceStoragePath) {
    throw new Error("Artwork source file is unavailable.");
  }

  const object = await getStorageProvider().downloadObject(
    artwork.sourceStoragePath
  );

  return {
    bytes: object.bytes,
    mimeType: mimeTypeFromContentType(object.contentType)
  };
}

function dataUrlToSource(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);

  if (!match) {
    throw new Error("Artwork preview data is not a valid image data URL.");
  }

  return {
    bytes: Buffer.from(match[2], "base64"),
    mimeType: mimeTypeFromContentType(match[1])
  };
}

function mimeTypeFromContentType(
  contentType: string
): "image/png" | "image/jpeg" | "image/webp" {
  if (contentType.includes("png")) {
    return "image/png";
  }

  if (contentType.includes("webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}

function buildSupportFiles(input: {
  project: FirestoreProject;
  job: LocalExportJob;
  printFiles: BuiltPrintFile[];
  printBuild: {
    sourceWidth: number;
    sourceHeight: number;
    workingWidth: number;
    workingHeight: number;
    upscaleProvider: string;
    upscaleUsage?: Record<string, unknown>;
  };
}): BuiltExportFile[] {
  const promptInputs = input.project.promptInputs;
  const styleLabel =
    STYLE_PRESETS[promptInputs.stylePresetKey]?.label ?? "Printable Art";
  const listingCopy = createListingCopy({
    subject: promptInputs.subject,
    styleLabel,
    ratios: input.job.requestedRatioKeys
  });
  const manifest = {
    exportId: input.job.id,
    projectId: input.job.projectId,
    artworkId: input.job.artworkId,
    createdAt: new Date().toISOString(),
    sourcePixels: {
      width: input.printBuild.sourceWidth,
      height: input.printBuild.sourceHeight
    },
    workingPixels: {
      width: input.printBuild.workingWidth,
      height: input.printBuild.workingHeight
    },
    upscaleProvider: input.printBuild.upscaleProvider,
    upscaleUsage: input.printBuild.upscaleUsage,
    files: input.printFiles.map((file) => ({
      fileName: file.fileName,
      ratioKey: file.ratioKey,
      width: file.width,
      height: file.height,
      bytes: file.bytes.byteLength,
      quality: file.quality
    })),
    etsy: {
      maxUploadFiles: 5,
      targetUploadBytes: 18 * 1024 * 1024,
      hardUploadBytes: 20 * 1024 * 1024
    }
  };

  return [
    {
      fileName: "listing-copy.txt",
      bytes: Buffer.from(
        [
          listingCopy.title,
          "",
          listingCopy.description,
          "",
          `Tags: ${listingCopy.tags.join(", ")}`
        ].join("\n"),
        "utf8"
      ),
      contentType: "text/plain; charset=utf-8",
      kind: "listing_txt"
    },
    {
      fileName: "buyer-instructions.txt",
      bytes: Buffer.from(
        [
          "Thank you for your purchase.",
          "",
          "This is a digital download. No physical item will be shipped.",
          "Choose the JPG file that matches your frame ratio and print size.",
          "For best results, print at a professional print shop or with high-quality photo paper.",
          "Colors may vary slightly between screens, printers, papers, and local print shops."
        ].join("\n"),
        "utf8"
      ),
      contentType: "text/plain; charset=utf-8",
      kind: "other"
    },
    {
      fileName: "wallpack-manifest.json",
      bytes: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
      contentType: "application/json",
      kind: "manifest_json"
    }
  ];
}

async function uploadPartitionedZips(input: {
  userId: string;
  projectId: string;
  jobId: string;
  allFiles: BuiltExportFile[];
  printFiles: BuiltPrintFile[];
  uploadPartitions: Array<{
    uploadName: string;
    files: Array<{ fileName: string }>;
  }>;
}) {
  const fileMap = new Map(
    input.allFiles.map((file) => [file.fileName, file] as const)
  );
  const artifacts: ExportArtifactView[] = [];

  for (const [index, upload] of input.uploadPartitions.entries()) {
    const zipFiles = upload.files.map((file) => {
      const matched = fileMap.get(file.fileName);

      if (!matched) {
        throw new Error(
          `Export file missing from ZIP payload: ${file.fileName}`
        );
      }

      return {
        path: matched.fileName,
        bytes: matched.bytes
      };
    });
    const zipBytes = createZipArchive(zipFiles);
    const storagePath = [
      "exports",
      safeStorageSegment(input.userId),
      safeStorageSegment(input.projectId),
      safeStorageSegment(input.jobId),
      sanitizeFilename(upload.uploadName, `wallpack-${index + 1}.zip`)
    ].join("/");

    await getStorageProvider().uploadObject({
      path: storagePath,
      bytes: zipBytes,
      contentType: "application/zip",
      metadata: {
        projectId: input.projectId,
        exportJobId: input.jobId
      }
    });

    const signedUrl = await getStorageProvider().createSignedDownloadUrl(
      storagePath,
      { ttlSeconds: 60 * 60 }
    );
    const ratioKeys = upload.files
      .map((file) =>
        input.printFiles.find(
          (printFile) => printFile.fileName === file.fileName
        )
      )
      .filter((file): file is BuiltPrintFile => Boolean(file))
      .map((file) => file.ratioKey);

    artifacts.push({
      artifactId: `artf_${randomUUID()}`,
      kind: "etsy_upload_zip",
      fileName: sanitizeFilename(
        upload.uploadName,
        `wallpack-${index + 1}.zip`
      ),
      storagePath,
      contentType: "application/zip",
      bytes: zipBytes.byteLength,
      ratioKeys,
      downloadUrl: signedUrl.url,
      downloadUrlExpiresAt: signedUrl.expiresAt.toISOString(),
      createdAt: new Date().toISOString()
    });
  }

  return artifacts;
}

function toExportJobView(job: LocalExportJob): ExportJobView {
  return {
    jobId: job.id,
    projectId: job.projectId,
    projectName: job.projectName,
    artworkId: job.artworkId,
    status: job.status,
    stage: job.stage,
    requestedRatioKeys: job.requestedRatioKeys,
    creditCost: job.creditCost,
    creditReserved: job.creditReserved,
    creditCommitted: job.creditCommitted,
    retryable: job.retryable,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    artifacts: job.artifacts,
    files: job.files,
    warnings: job.warnings,
    externalDeliveryNotRecommended: job.externalDeliveryNotRecommended,
    createdAt: job.createdAt.toISOString(),
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null
  };
}

function artifactSizeWarnings(artifacts: ExportArtifactView[]) {
  return artifacts.flatMap((artifact) => {
    if (artifact.bytes > 20 * 1024 * 1024) {
      return [`${artifact.fileName} is larger than Etsy's 20 MB hard limit.`];
    }

    if (artifact.bytes > 18 * 1024 * 1024) {
      return [`${artifact.fileName} is above the 18 MB Etsy safety target.`];
    }

    return [];
  });
}

async function persistExportJob(job: LocalExportJob) {
  await saveFirestoreExportJob(toExportJobView(job), {
    userId: job.userId
  });
}

function safeStorageSegment(value: string) {
  return sanitizeFilename(value, "wallpack").replaceAll(".", "-");
}
