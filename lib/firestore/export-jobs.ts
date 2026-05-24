import { getFirebaseFirestore } from "@/lib/firebase/admin";
import {
  exportJobDocumentPath,
  FIRESTORE_COLLECTIONS
} from "@/lib/firestore/collections";
import type {
  ExportArtifactView,
  ExportJobView,
  ExportPrintFileView
} from "@/lib/jobs/export-types";
import type { JobStatus } from "@/lib/jobs/job-runner";
import { getStorageProvider } from "@/lib/storage";

type FirestoreExportJobDocument = ExportJobView & {
  userId: string;
};

export async function saveFirestoreExportJob(
  job: ExportJobView,
  options: { userId: string }
) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const document: FirestoreExportJobDocument = {
    ...job,
    artifacts: job.artifacts.map(exportArtifactDocument),
    userId: options.userId
  };

  await getFirebaseFirestore().doc(exportJobDocumentPath(job.jobId)).set(
    document,
    { merge: true }
  );
}

export async function getFirestoreExportJobForUser(
  jobId: string,
  userId: string
) {
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  const snapshot = await getFirebaseFirestore()
    .doc(exportJobDocumentPath(jobId))
    .get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() ?? {};

  if (data.userId !== userId) {
    return null;
  }

  return signExportArtifacts(firestoreExportJobFromDocument(snapshot.id, data));
}

export async function listFirestoreExportJobsForUser(
  userId: string,
  options: { limit?: number; projectId?: string } = {}
) {
  if (process.env.NODE_ENV === "test") {
    return [];
  }

  const snapshot = await getFirebaseFirestore()
    .collection(FIRESTORE_COLLECTIONS.exportJobs)
    .where("userId", "==", userId)
    .get();
  const jobs = snapshot.docs
    .map((doc) => firestoreExportJobFromDocument(doc.id, doc.data()))
    .filter((job) => !options.projectId || job.projectId === options.projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const limited = jobs.slice(0, options.limit ?? 10);

  return Promise.all(limited.map(signExportArtifacts));
}

export function firestoreExportJobFromDocument(
  id: string,
  data: FirebaseFirestore.DocumentData
): ExportJobView {
  return {
    jobId: id,
    projectId: stringOrFallback(data.projectId, ""),
    projectName: stringOrFallback(data.projectName, "Untitled wall-art pack"),
    artworkId: stringOrFallback(data.artworkId, ""),
    status: jobStatusOrFallback(data.status),
    stage: nullableString(data.stage),
    requestedRatioKeys: Array.isArray(data.requestedRatioKeys)
      ? data.requestedRatioKeys
      : [],
    creditCost: numberOrFallback(data.creditCost, 0),
    creditReserved: data.creditReserved === true,
    creditCommitted: data.creditCommitted === true,
    retryable: data.retryable === true,
    errorCode: nullableString(data.errorCode),
    errorMessage: nullableString(data.errorMessage),
    artifacts: artifactArrayOrFallback(data.artifacts),
    files: fileArrayOrFallback(data.files),
    warnings: stringArrayOrFallback(data.warnings),
    externalDeliveryNotRecommended:
      data.externalDeliveryNotRecommended === true,
    createdAt: stringOrFallback(data.createdAt, new Date(0).toISOString()),
    startedAt: nullableString(data.startedAt),
    completedAt: nullableString(data.completedAt)
  };
}

function exportArtifactDocument(
  artifact: ExportArtifactView
): ExportArtifactView {
  return {
    artifactId: artifact.artifactId,
    kind: artifact.kind,
    fileName: artifact.fileName,
    storagePath: artifact.storagePath,
    contentType: artifact.contentType,
    bytes: artifact.bytes,
    ratioKeys: artifact.ratioKeys,
    createdAt: artifact.createdAt
  };
}

async function signExportArtifacts(job: ExportJobView): Promise<ExportJobView> {
  const artifacts = await Promise.all(
    job.artifacts.map(async (artifact) => {
      const signedUrl = await getStorageProvider().createSignedDownloadUrl(
        artifact.storagePath,
        { ttlSeconds: 60 * 60 }
      );

      return {
        ...artifact,
        downloadUrl: signedUrl.url,
        downloadUrlExpiresAt: signedUrl.expiresAt.toISOString()
      };
    })
  );

  return { ...job, artifacts };
}

function artifactArrayOrFallback(value: unknown): ExportArtifactView[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isExportArtifact);
}

function fileArrayOrFallback(value: unknown): ExportPrintFileView[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isExportPrintFile);
}

function isExportArtifact(value: unknown): value is ExportArtifactView {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ExportArtifactView).artifactId === "string" &&
    typeof (value as ExportArtifactView).fileName === "string" &&
    typeof (value as ExportArtifactView).storagePath === "string"
  );
}

function isExportPrintFile(value: unknown): value is ExportPrintFileView {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ExportPrintFileView).fileName === "string" &&
    typeof (value as ExportPrintFileView).width === "number" &&
    typeof (value as ExportPrintFileView).height === "number"
  );
}

function jobStatusOrFallback(value: unknown): JobStatus {
  if (
    value === "queued" ||
    value === "validating" ||
    value === "running" ||
    value === "processing" ||
    value === "uploading" ||
    value === "succeeded" ||
    value === "failed" ||
    value === "cancelled"
  ) {
    return value;
  }

  return "queued";
}

function stringArrayOrFallback(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function stringOrFallback(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function numberOrFallback(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
