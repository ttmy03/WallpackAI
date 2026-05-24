import { getFirebaseFirestore } from "@/lib/firebase/admin";
import {
  artworkDocumentPath,
  FIRESTORE_COLLECTIONS,
  generationJobDocumentPath
} from "@/lib/firestore/collections";
import type {
  GeneratedArtworkPreview,
  GenerationJobView
} from "@/lib/jobs/generation-types";
import type { JobStatus } from "@/lib/jobs/job-runner";
import { getStorageProvider } from "@/lib/storage";

type FirestoreGenerationJobDocument = Omit<GenerationJobView, "artworks"> & {
  userId: string;
  artworkIds: string[];
};

type FirestoreArtworkDocument = {
  artworkId: string;
  width: number;
  height: number;
  mimeType: GeneratedArtworkPreview["mimeType"];
  providerRequestId: string | null;
  sourceStoragePath: string;
  previewStoragePath: string;
  createdAt: string;
  userId: string;
  projectId: string;
  generationJobId: string;
};

export async function saveFirestoreGenerationJob(
  job: GenerationJobView,
  options: { userId: string }
) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const db = getFirebaseFirestore();
  const batch = db.batch();
  const { artworks, ...jobData } = job;
  const artworkIds = artworks.map((artwork) => artwork.artworkId);
  const jobDocument: FirestoreGenerationJobDocument = {
    ...jobData,
    userId: options.userId,
    artworkIds
  };

  batch.set(db.doc(generationJobDocumentPath(job.jobId)), jobDocument, {
    merge: true
  });

  for (const artwork of artworks) {
    const artworkDocument = firestoreArtworkDocumentFromPreview(artwork, {
      userId: options.userId,
      projectId: job.projectId,
      generationJobId: job.jobId
    });
    batch.set(db.doc(artworkDocumentPath(artwork.artworkId)), artworkDocument, {
      merge: true
    });
  }

  await batch.commit();
}

export async function getFirestoreGenerationJobForUser(
  jobId: string,
  userId: string
) {
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  const db = getFirebaseFirestore();
  const snapshot = await db.doc(generationJobDocumentPath(jobId)).get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() ?? {};

  if (data.userId !== userId) {
    return null;
  }

  const job = firestoreGenerationJobFromDocument(snapshot.id, data);
  const artworkSnapshot = await db
    .collection(FIRESTORE_COLLECTIONS.artworks)
    .where("generationJobId", "==", job.jobId)
    .where("userId", "==", userId)
    .get();
  const artworks = await Promise.all(
    artworkSnapshot.docs.map((doc) =>
      artworkPreviewFromDocument(doc.id, doc.data())
    )
  );

  return {
    ...job,
    artworks: artworks.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  };
}

export function firestoreGenerationJobFromDocument(
  id: string,
  data: FirebaseFirestore.DocumentData
): GenerationJobView {
  return {
    jobId: id,
    projectId: stringOrFallback(data.projectId, ""),
    projectName: stringOrFallback(data.projectName, "Untitled wall-art pack"),
    status: jobStatusOrFallback(data.status),
    stage: nullableString(data.stage),
    requestedCount: numberOrFallback(data.requestedCount, 0),
    creditCost: numberOrFallback(data.creditCost, 0),
    creditReserved: data.creditReserved === true,
    creditCommitted: data.creditCommitted === true,
    prompt: stringOrFallback(data.prompt, ""),
    negativePrompt: stringOrFallback(data.negativePrompt, ""),
    primaryRatio: stringOrFallback(data.primaryRatio, "2x3"),
    quality:
      data.quality === "standard" || data.quality === "premium"
        ? data.quality
        : "draft",
    retryable: data.retryable === true,
    errorCode: nullableString(data.errorCode),
    errorMessage: nullableString(data.errorMessage),
    artworks: [],
    createdAt: stringOrFallback(data.createdAt, new Date(0).toISOString()),
    startedAt: nullableString(data.startedAt),
    completedAt: nullableString(data.completedAt)
  };
}

function firestoreArtworkDocumentFromPreview(
  artwork: GeneratedArtworkPreview,
  input: { userId: string; projectId: string; generationJobId: string }
): FirestoreArtworkDocument {
  return {
    artworkId: artwork.artworkId,
    width: artwork.width,
    height: artwork.height,
    mimeType: artwork.mimeType,
    providerRequestId: artwork.providerRequestId ?? null,
    sourceStoragePath: artwork.sourceStoragePath,
    previewStoragePath: artwork.previewStoragePath ?? artwork.sourceStoragePath,
    createdAt: artwork.createdAt,
    userId: input.userId,
    projectId: input.projectId,
    generationJobId: input.generationJobId
  };
}

async function artworkPreviewFromDocument(
  id: string,
  data: FirebaseFirestore.DocumentData
): Promise<GeneratedArtworkPreview> {
  const previewStoragePath = stringOrFallback(
    data.previewStoragePath,
    stringOrFallback(data.sourceStoragePath, "")
  );
  const signedUrl =
    previewStoragePath.length > 0
      ? await getStorageProvider().createSignedDownloadUrl(previewStoragePath)
      : null;

  return {
    artworkId: id,
    width: numberOrFallback(data.width, 0),
    height: numberOrFallback(data.height, 0),
    mimeType:
      data.mimeType === "image/jpeg" || data.mimeType === "image/webp"
        ? data.mimeType
        : "image/png",
    providerRequestId: nullableString(data.providerRequestId) ?? undefined,
    sourceStoragePath: stringOrFallback(data.sourceStoragePath, ""),
    previewStoragePath,
    previewUrl: signedUrl?.url,
    previewUrlExpiresAt: signedUrl?.expiresAt.toISOString(),
    createdAt: stringOrFallback(data.createdAt, new Date(0).toISOString())
  };
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

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function stringOrFallback(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function numberOrFallback(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
