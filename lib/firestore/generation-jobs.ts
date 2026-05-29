import { getFirebaseFirestore } from "@/lib/firebase/admin";
import {
  artworkDocumentPath,
  FIRESTORE_COLLECTIONS,
  generationJobDocumentPath
} from "@/lib/firestore/collections";
import type {
  GeneratedArtworkDimensionPreview,
  GeneratedArtworkMimeType,
  GeneratedArtworkPreview,
  GenerationJobView
} from "@/lib/jobs/generation-types";
import type { JobStatus } from "@/lib/jobs/job-runner";
import { isPrintRatioPresetKey } from "@/lib/print/presets";
import {
  createOptionalSignedDownloadUrl,
  createOptionalStorageDataUrl
} from "@/lib/storage";

type FirestoreGenerationJobDocument = Omit<GenerationJobView, "artworks"> & {
  userId: string;
  artworkIds: string[];
};

export type FirestoreGenerationJobRecord = {
  userId: string;
  job: GenerationJobView;
};

type FirestoreArtworkDocument = {
  artworkId: string;
  width: number;
  height: number;
  mimeType: GeneratedArtworkPreview["mimeType"];
  providerRequestId: string | null;
  sourceStoragePath: string;
  previewStoragePath: string;
  dimensionPreviews: FirestoreArtworkDimensionPreviewDocument[];
  createdAt: string;
  userId: string;
  projectId: string;
  generationJobId: string;
};

type FirestoreArtworkDimensionPreviewDocument = {
  ratioKey: GeneratedArtworkDimensionPreview["ratioKey"];
  sourceStoragePath?: string;
  sourceWidth?: number;
  sourceHeight?: number;
  sourceMimeType?: GeneratedArtworkMimeType;
  sourceProviderRequestId?: string;
  printWidth: number;
  printHeight: number;
  previewWidth: number;
  previewHeight: number;
  previewStoragePath: string;
  createdAt: string;
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
  const record = await getFirestoreGenerationJobRecord(jobId);

  if (!record || record.userId !== userId) {
    return null;
  }

  return record.job;
}

export async function getFirestoreGenerationJobRecord(
  jobId: string
): Promise<FirestoreGenerationJobRecord | null> {
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  const db = getFirebaseFirestore();
  const snapshot = await db.doc(generationJobDocumentPath(jobId)).get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() ?? {};
  const userId = stringOrFallback(data.userId, "");

  if (!userId) {
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
    userId,
    job: {
      ...job,
      artworks: artworks.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    }
  };
}

export async function claimFirestoreGenerationJob(
  jobId: string,
  options: { leaseOwner: string; leaseMs: number; now?: Date }
): Promise<FirestoreGenerationJobRecord | null> {
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  const db = getFirebaseFirestore();
  const jobRef = db.doc(generationJobDocumentPath(jobId));
  let claimed: FirestoreGenerationJobRecord | null = null;

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);

    if (!snapshot.exists) {
      return;
    }

    const data = snapshot.data() ?? {};
    const userId = stringOrFallback(data.userId, "");
    const job = firestoreGenerationJobFromDocument(snapshot.id, data);

    if (!userId || job.status !== "queued") {
      return;
    }

    const now = options.now ?? new Date();
    const updatedAt = now.toISOString();
    const update = {
      status: "validating" as const,
      stage: "credit_reservation",
      startedAt: job.startedAt ?? updatedAt,
      updatedAt,
      leaseOwner: options.leaseOwner,
      leaseExpiresAt: new Date(now.getTime() + options.leaseMs).toISOString(),
      attemptCount: job.attemptCount + 1
    };

    transaction.set(jobRef, update, { merge: true });
    claimed = {
      userId,
      job: {
        ...job,
        ...update,
        artworks: []
      }
    };
  });

  return claimed;
}

export async function listFirestoreGenerationJobsForUser(
  userId: string,
  options: { limit?: number; projectId?: string } = {}
) {
  if (process.env.NODE_ENV === "test") {
    return [];
  }

  const snapshot = await getFirebaseFirestore()
    .collection(FIRESTORE_COLLECTIONS.generationJobs)
    .where("userId", "==", userId)
    .get();
  const jobs = snapshot.docs
    .map((doc) => firestoreGenerationJobFromDocument(doc.id, doc.data()))
    .filter((job) => !options.projectId || job.projectId === options.projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return jobs.slice(0, options.limit ?? 10);
}

export async function listFirestoreArtworksForProject(
  userId: string,
  projectId: string
) {
  if (process.env.NODE_ENV === "test") {
    return [];
  }

  const snapshot = await getFirebaseFirestore()
    .collection(FIRESTORE_COLLECTIONS.artworks)
    .where("userId", "==", userId)
    .get();
  const artworks = await Promise.all(
    snapshot.docs
      .filter((doc) => doc.data().projectId === projectId)
      .map((doc) => artworkPreviewFromDocument(doc.id, doc.data()))
  );

  return artworks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
    creditRefunded: data.creditRefunded === true,
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
    updatedAt: stringOrFallback(
      data.updatedAt,
      stringOrFallback(
        data.completedAt,
        stringOrFallback(
          data.startedAt,
          stringOrFallback(data.createdAt, new Date(0).toISOString())
        )
      )
    ),
    startedAt: nullableString(data.startedAt),
    completedAt: nullableString(data.completedAt),
    leaseOwner: nullableString(data.leaseOwner),
    leaseExpiresAt: nullableString(data.leaseExpiresAt),
    attemptCount: numberOrFallback(data.attemptCount, 0)
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
    dimensionPreviews: (artwork.dimensionPreviews ?? []).map(
      firestoreArtworkDimensionPreviewDocumentFromPreview
    ),
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
      ? await createOptionalSignedDownloadUrl(previewStoragePath)
      : null;
  const dataUrl =
    !signedUrl && previewStoragePath.length > 0
      ? await createOptionalStorageDataUrl(previewStoragePath)
      : undefined;

  return {
    artworkId: id,
    dataUrl: dataUrl ?? undefined,
    width: numberOrFallback(data.width, 0),
    height: numberOrFallback(data.height, 0),
    mimeType: imageMimeTypeOrFallback(data.mimeType, "image/png"),
    providerRequestId: nullableString(data.providerRequestId) ?? undefined,
    sourceStoragePath: stringOrFallback(data.sourceStoragePath, ""),
    previewStoragePath,
    previewUrl: signedUrl?.url,
    previewUrlExpiresAt: signedUrl?.expiresAt.toISOString(),
    dimensionPreviews: await Promise.all(
      artworkDimensionPreviewDocuments(data.dimensionPreviews).map(
        artworkDimensionPreviewFromDocument
      )
    ),
    createdAt: stringOrFallback(data.createdAt, new Date(0).toISOString())
  };
}

function firestoreArtworkDimensionPreviewDocumentFromPreview(
  preview: GeneratedArtworkDimensionPreview
): FirestoreArtworkDimensionPreviewDocument {
  const document: FirestoreArtworkDimensionPreviewDocument = {
    ratioKey: preview.ratioKey,
    printWidth: preview.printWidth,
    printHeight: preview.printHeight,
    previewWidth: preview.previewWidth,
    previewHeight: preview.previewHeight,
    previewStoragePath: preview.previewStoragePath ?? "",
    createdAt: preview.createdAt
  };

  if (preview.sourceStoragePath) {
    document.sourceStoragePath = preview.sourceStoragePath;
  }

  if (typeof preview.sourceWidth === "number") {
    document.sourceWidth = preview.sourceWidth;
  }

  if (typeof preview.sourceHeight === "number") {
    document.sourceHeight = preview.sourceHeight;
  }

  if (preview.sourceMimeType) {
    document.sourceMimeType = preview.sourceMimeType;
  }

  if (preview.sourceProviderRequestId) {
    document.sourceProviderRequestId = preview.sourceProviderRequestId;
  }

  return document;
}

async function artworkDimensionPreviewFromDocument(
  data: FirestoreArtworkDimensionPreviewDocument
): Promise<GeneratedArtworkDimensionPreview> {
  const signedUrl =
    data.previewStoragePath.length > 0
      ? await createOptionalSignedDownloadUrl(data.previewStoragePath)
      : null;
  const dataUrl =
    !signedUrl && data.previewStoragePath.length > 0
      ? await createOptionalStorageDataUrl(data.previewStoragePath)
      : undefined;

  return {
    ratioKey: data.ratioKey,
    dataUrl: dataUrl ?? undefined,
    sourceStoragePath: data.sourceStoragePath,
    sourceWidth: data.sourceWidth,
    sourceHeight: data.sourceHeight,
    sourceMimeType: data.sourceMimeType,
    sourceProviderRequestId: data.sourceProviderRequestId,
    printWidth: data.printWidth,
    printHeight: data.printHeight,
    previewWidth: data.previewWidth,
    previewHeight: data.previewHeight,
    previewStoragePath: data.previewStoragePath,
    previewUrl: signedUrl?.url,
    previewUrlExpiresAt: signedUrl?.expiresAt.toISOString(),
    createdAt: data.createdAt
  };
}

function artworkDimensionPreviewDocuments(
  value: unknown
): FirestoreArtworkDimensionPreviewDocument[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((preview): FirestoreArtworkDimensionPreviewDocument | null => {
      if (typeof preview !== "object" || preview === null) {
        return null;
      }

      const data = preview as Record<string, unknown>;

      if (
        !isPrintRatioPresetKey(data.ratioKey) ||
        typeof data.previewStoragePath !== "string"
      ) {
        return null;
      }

      return {
        ratioKey: data.ratioKey,
        sourceStoragePath: optionalString(data.sourceStoragePath),
        sourceWidth: optionalNumber(data.sourceWidth),
        sourceHeight: optionalNumber(data.sourceHeight),
        sourceMimeType: imageMimeTypeOrNull(data.sourceMimeType),
        sourceProviderRequestId: optionalString(data.sourceProviderRequestId),
        printWidth: numberOrFallback(data.printWidth, 0),
        printHeight: numberOrFallback(data.printHeight, 0),
        previewWidth: numberOrFallback(data.previewWidth, 0),
        previewHeight: numberOrFallback(data.previewHeight, 0),
        previewStoragePath: data.previewStoragePath,
        createdAt: stringOrFallback(data.createdAt, new Date(0).toISOString())
      };
    })
    .filter(
      (preview): preview is FirestoreArtworkDimensionPreviewDocument =>
        preview !== null
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

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringOrFallback(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function numberOrFallback(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function imageMimeTypeOrFallback(
  value: unknown,
  fallback: GeneratedArtworkMimeType
): GeneratedArtworkMimeType {
  return value === "image/png" ||
    value === "image/jpeg" ||
    value === "image/webp"
    ? value
    : fallback;
}

function imageMimeTypeOrNull(value: unknown) {
  return value === "image/png" ||
    value === "image/jpeg" ||
    value === "image/webp"
    ? value
    : undefined;
}
