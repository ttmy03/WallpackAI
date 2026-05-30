import sharp from "sharp";

import { getFirebaseFirestore } from "@/lib/firebase/admin";
import {
  FIRESTORE_COLLECTIONS,
  mockupJobDocumentPath
} from "@/lib/firestore/collections";
import type {
  MockupArtifactView,
  MockupImageView,
  MockupJobView
} from "@/lib/jobs/mockup-types";
import type { JobStatus } from "@/lib/jobs/job-runner";
import {
  isPrintRatioPresetKey,
  type PrintRatioPresetKey
} from "@/lib/print/presets";
import {
  getStorageProvider,
  createOptionalSignedDownloadUrl,
  createOptionalStorageDataUrl
} from "@/lib/storage";
import type { ListedObject } from "@/lib/storage/storage-provider";
import { sanitizeFilename } from "@/lib/print/filenames";

type FirestoreMockupJobDocument = MockupJobView & {
  userId: string;
};

export type FirestoreMockupJobRecord = {
  userId: string;
  job: MockupJobView;
};

export async function saveFirestoreMockupJob(
  job: MockupJobView,
  options: { userId: string }
) {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const document = firestoreMockupJobDocument(job, options.userId);

  await getFirebaseFirestore()
    .doc(mockupJobDocumentPath(job.jobId))
    .set(stripUndefined(document), { merge: true });
}

export async function saveFirestoreMockupJobIfUnchanged(
  job: MockupJobView,
  options: {
    userId: string;
    expectedStatus: MockupJobView["status"];
    expectedUpdatedAt: string;
  }
) {
  if (process.env.NODE_ENV === "test") {
    return { saved: true as const, job };
  }

  const db = getFirebaseFirestore();
  const jobRef = db.doc(mockupJobDocumentPath(job.jobId));
  let result: { saved: boolean; job: MockupJobView | null } = {
    saved: false,
    job: null
  };

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);

    if (!snapshot.exists) {
      return;
    }

    const data = snapshot.data() ?? {};
    const currentUserId = stringOrFallback(data.userId, "");
    const currentJob = firestoreMockupJobFromDocument(snapshot.id, data);

    if (currentUserId !== options.userId) {
      return;
    }

    if (
      currentJob.status !== options.expectedStatus ||
      currentJob.updatedAt !== options.expectedUpdatedAt
    ) {
      result = { saved: false, job: currentJob };
      return;
    }

    transaction.set(
      jobRef,
      stripUndefined(firestoreMockupJobDocument(job, options.userId)),
      { merge: true }
    );
    result = { saved: true, job };
  });

  return result;
}

export async function getFirestoreMockupJobForUser(
  jobId: string,
  userId: string
) {
  const record = await getFirestoreMockupJobRecord(jobId);

  if (!record || record.userId !== userId) {
    return null;
  }

  return signMockupJobAssets(record.job);
}

export async function getFirestoreMockupJobRecord(
  jobId: string
): Promise<FirestoreMockupJobRecord | null> {
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  const snapshot = await getFirebaseFirestore()
    .doc(mockupJobDocumentPath(jobId))
    .get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() ?? {};
  const userId = stringOrFallback(data.userId, "");

  if (!userId) {
    return null;
  }

  return {
    userId,
    job: firestoreMockupJobFromDocument(snapshot.id, data)
  };
}

export async function claimFirestoreMockupJob(
  jobId: string,
  options: { leaseOwner: string; leaseMs: number; now?: Date }
): Promise<FirestoreMockupJobRecord | null> {
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  const db = getFirebaseFirestore();
  const jobRef = db.doc(mockupJobDocumentPath(jobId));
  let claimed: FirestoreMockupJobRecord | null = null;

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);

    if (!snapshot.exists) {
      return;
    }

    const data = snapshot.data() ?? {};
    const userId = stringOrFallback(data.userId, "");
    const job = firestoreMockupJobFromDocument(snapshot.id, data);

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
        ...update
      }
    };
  });

  return claimed;
}

export async function listFirestoreMockupJobsForUser(
  userId: string,
  options: {
    limit?: number;
    projectId?: string;
    includeSignedDownloadUrls?: boolean;
  } = {}
) {
  if (process.env.NODE_ENV === "test") {
    return [];
  }

  const snapshot = await getFirebaseFirestore()
    .collection(FIRESTORE_COLLECTIONS.mockupJobs)
    .where("userId", "==", userId)
    .get();
  const projectJobs = snapshot.docs
    .map((doc) => firestoreMockupJobFromDocument(doc.id, doc.data()))
    .filter((job) => !options.projectId || job.projectId === options.projectId);
  const jobs = (await Promise.all(
    projectJobs.map((job) => recoverMissingMockupAssets(job, userId))
  ))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const limited = jobs.slice(0, options.limit ?? 10);

  if (options.includeSignedDownloadUrls === false) {
    return limited;
  }

  return Promise.all(limited.map(signMockupJobAssets));
}

export async function getLatestFirestoreMockupPackJobForUser(
  userId: string,
  options: {
    projectId?: string;
    includeSignedDownloadUrls?: boolean;
  } = {}
) {
  if (process.env.NODE_ENV === "test") {
    return null;
  }

  const snapshot = await getFirebaseFirestore()
    .collection(FIRESTORE_COLLECTIONS.mockupJobs)
    .where("userId", "==", userId)
    .get();
  const projectJobs = snapshot.docs
    .map((doc) => firestoreMockupJobFromDocument(doc.id, doc.data()))
    .filter((candidate) =>
      options.projectId ? candidate.projectId === options.projectId : true
    );
  const job =
    (await Promise.all(
      projectJobs.map((candidate) =>
        recoverMissingMockupAssets(candidate, userId)
      )
    ))
      .filter(hasMockupPackAssets)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;

  if (!job) {
    return null;
  }

  if (options.includeSignedDownloadUrls === false) {
    return job;
  }

  return signMockupJobAssets(job);
}

function firestoreMockupJobDocument(
  job: MockupJobView,
  userId: string
): FirestoreMockupJobDocument {
  return {
    ...job,
    images: job.images.map(mockupImageDocument),
    artifacts: job.artifacts.map(mockupArtifactDocument),
    userId
  };
}

export function firestoreMockupJobFromDocument(
  id: string,
  data: FirebaseFirestore.DocumentData
): MockupJobView {
  const createdAt = stringOrFallback(data.createdAt, new Date(0).toISOString());
  const updatedAt = stringOrFallback(
    data.updatedAt,
    stringOrFallback(
      data.completedAt,
      stringOrFallback(data.startedAt, createdAt)
    )
  );

  return {
    jobId: id,
    projectId: stringOrFallback(data.projectId, ""),
    projectName: stringOrFallback(data.projectName, "Untitled wall-art pack"),
    artworkId: stringOrFallback(data.artworkId, ""),
    ratioKey: ratioKeyOrNull(data.ratioKey),
    status: mockupJobStatusOrFallback(data),
    stage: nullableString(data.stage),
    creditCost: numberOrFallback(data.creditCost, 0),
    creditReserved: data.creditReserved === true,
    creditCommitted: data.creditCommitted === true,
    creditRefunded: data.creditRefunded === true,
    retryable: data.retryable === true,
    errorCode: nullableString(data.errorCode),
    errorMessage: nullableString(data.errorMessage),
    prompt: stringOrFallback(data.prompt, ""),
    images: imageArrayOrFallback(data.images),
    artifacts: artifactArrayOrFallback(data.artifacts),
    createdAt,
    updatedAt,
    startedAt: nullableString(data.startedAt),
    completedAt: nullableString(data.completedAt),
    leaseOwner: nullableString(data.leaseOwner),
    leaseExpiresAt: nullableString(data.leaseExpiresAt),
    attemptCount: numberOrFallback(data.attemptCount, 0)
  };
}

function mockupImageDocument(image: MockupImageView): MockupImageView {
  return stripUndefined({
    imageId: image.imageId,
    fileName: image.fileName,
    storagePath: image.storagePath,
    contentType: image.contentType,
    bytes: image.bytes,
    width: image.width,
    height: image.height,
    providerRequestId: image.providerRequestId,
    usage: image.usage,
    createdAt: image.createdAt
  });
}

function mockupArtifactDocument(
  artifact: MockupArtifactView
): MockupArtifactView {
  return {
    artifactId: artifact.artifactId,
    kind: artifact.kind,
    fileName: artifact.fileName,
    storagePath: artifact.storagePath,
    contentType: artifact.contentType,
    bytes: artifact.bytes,
    createdAt: artifact.createdAt
  };
}

async function signMockupJobAssets(job: MockupJobView): Promise<MockupJobView> {
  const [images, artifacts] = await Promise.all([
    Promise.all(job.images.map(signMockupImage)),
    Promise.all(job.artifacts.map(signMockupArtifact))
  ]);

  return { ...job, images, artifacts };
}

async function signMockupImage(image: MockupImageView): Promise<MockupImageView> {
  const signedUrl = await createOptionalSignedDownloadUrl(image.storagePath);

  if (signedUrl) {
    return {
      ...image,
      previewUrl: signedUrl.url,
      previewUrlExpiresAt: signedUrl.expiresAt.toISOString()
    };
  }

  const dataUrl = await createOptionalStorageDataUrl(image.storagePath);

  return {
    ...image,
    dataUrl: dataUrl ?? undefined
  };
}

async function signMockupArtifact(
  artifact: MockupArtifactView
): Promise<MockupArtifactView> {
  const signedUrl = await createOptionalSignedDownloadUrl(
    artifact.storagePath,
    {
      ttlSeconds: 60 * 60
    }
  );

  return {
    ...artifact,
    downloadUrl: signedUrl?.url,
    downloadUrlExpiresAt: signedUrl?.expiresAt.toISOString()
  };
}

function imageArrayOrFallback(value: unknown): MockupImageView[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isMockupImage);
}

function artifactArrayOrFallback(value: unknown): MockupArtifactView[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isMockupArtifact);
}

function isMockupImage(value: unknown): value is MockupImageView {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as MockupImageView).imageId === "string" &&
    typeof (value as MockupImageView).fileName === "string" &&
    typeof (value as MockupImageView).storagePath === "string" &&
    typeof (value as MockupImageView).width === "number" &&
    typeof (value as MockupImageView).height === "number"
  );
}

function isMockupArtifact(value: unknown): value is MockupArtifactView {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as MockupArtifactView).artifactId === "string" &&
    typeof (value as MockupArtifactView).fileName === "string" &&
    typeof (value as MockupArtifactView).storagePath === "string"
  );
}

function hasMockupPackAssets(job: MockupJobView) {
  return job.images.length > 0 || job.artifacts.length > 0;
}

async function recoverMissingMockupAssets(
  job: MockupJobView,
  userId: string
) {
  if (!shouldRecoverMockupAssets(job)) {
    return job;
  }

  const prefix = mockupJobStoragePrefix(userId, job.projectId, job.jobId);
  let objects: ListedObject[];

  try {
    objects = await getStorageProvider().listObjects(prefix);
  } catch (error) {
    console.warn(`Unable to recover mockup files for ${job.jobId}.`, error);
    return job;
  }

  const imageObjects = objects.filter(isRecoverableMockupImage).sort(byPath);
  const artifactObjects = objects.filter(isRecoverableMockupZip).sort(byPath);

  if (imageObjects.length === 0 && artifactObjects.length === 0) {
    return job;
  }

  const recoveredAt = new Date().toISOString();
  const createdAt = job.completedAt ?? job.updatedAt ?? job.createdAt;
  const [images, artifacts] = await Promise.all([
    Promise.all(
      imageObjects.map((object, index) =>
        recoveredMockupImageFromObject(object, index, createdAt)
      )
    ),
    Promise.resolve(
      artifactObjects.map((object, index) =>
        recoveredMockupArtifactFromObject(object, index, createdAt)
      )
    )
  ]);
  const recoveredCompletePack = artifacts.length > 0;
  const recoveredJob: MockupJobView = {
    ...job,
    status: recoveredCompletePack ? "succeeded" : job.status,
    stage: recoveredCompletePack ? "recovered" : job.stage,
    retryable: recoveredCompletePack ? false : job.retryable,
    errorCode: recoveredCompletePack ? null : job.errorCode,
    errorMessage: recoveredCompletePack ? null : job.errorMessage,
    images,
    artifacts,
    updatedAt: recoveredAt,
    completedAt: job.completedAt ?? recoveredAt
  };

  await saveFirestoreMockupJob(recoveredJob, { userId });

  return recoveredJob;
}

function shouldRecoverMockupAssets(job: MockupJobView) {
  return (
    job.images.length === 0 &&
    job.artifacts.length === 0 &&
    job.status === "failed" &&
    job.errorCode === "MOCKUP_TIMEOUT"
  );
}

async function recoveredMockupImageFromObject(
  object: ListedObject,
  index: number,
  createdAt: string
): Promise<MockupImageView> {
  const contentType = mockupImageContentType(object);
  let width = 0;
  let height = 0;

  try {
    const downloaded = await getStorageProvider().downloadObject(object.path);
    const metadata = await sharp(downloaded.bytes).metadata();
    width = positiveIntegerOrZero(metadata.width);
    height = positiveIntegerOrZero(metadata.height);
  } catch (error) {
    console.warn(`Unable to read recovered mockup dimensions for ${object.path}.`, error);
  }

  return {
    imageId: `mcki_recovered_${index + 1}`,
    fileName: fileNameFromStoragePath(object.path),
    storagePath: object.path,
    contentType,
    bytes: object.bytes,
    width,
    height,
    createdAt: object.updatedAt ?? createdAt
  };
}

function recoveredMockupArtifactFromObject(
  object: ListedObject,
  index: number,
  createdAt: string
): MockupArtifactView {
  return {
    artifactId: `mcka_recovered_${index + 1}`,
    kind: "mockup_zip",
    fileName: fileNameFromStoragePath(object.path),
    storagePath: object.path,
    contentType: object.contentType || "application/zip",
    bytes: object.bytes,
    createdAt: object.updatedAt ?? createdAt
  };
}

function isRecoverableMockupImage(object: ListedObject) {
  return mockupImageContentTypeOrNull(object) !== null;
}

function isRecoverableMockupZip(object: ListedObject) {
  const path = object.path.toLowerCase();
  const contentType = object.contentType.toLowerCase();

  return contentType.includes("zip") || path.endsWith(".zip");
}

function mockupImageContentType(
  object: ListedObject
): MockupImageView["contentType"] {
  return mockupImageContentTypeOrNull(object) ?? "image/png";
}

function mockupImageContentTypeOrNull(
  object: ListedObject
): MockupImageView["contentType"] | null {
  const path = object.path.toLowerCase();
  const contentType = object.contentType.toLowerCase();

  if (contentType.includes("png") || path.endsWith(".png")) {
    return "image/png";
  }

  if (
    contentType.includes("jpeg") ||
    contentType.includes("jpg") ||
    path.endsWith(".jpg") ||
    path.endsWith(".jpeg")
  ) {
    return "image/jpeg";
  }

  if (contentType.includes("webp") || path.endsWith(".webp")) {
    return "image/webp";
  }

  return null;
}

function mockupJobStoragePrefix(userId: string, projectId: string, jobId: string) {
  return [
    "mockups",
    safeStorageSegment(userId),
    safeStorageSegment(projectId),
    safeStorageSegment(jobId),
    ""
  ].join("/");
}

function safeStorageSegment(value: string) {
  return sanitizeFilename(value, "wallpack").replaceAll(".", "-");
}

function fileNameFromStoragePath(path: string) {
  return path.split("/").at(-1) || "mockup-file";
}

function byPath(a: ListedObject, b: ListedObject) {
  return a.path.localeCompare(b.path);
}

function positiveIntegerOrZero(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : 0;
}

function ratioKeyOrNull(value: unknown): PrintRatioPresetKey | null {
  return isPrintRatioPresetKey(value) ? value : null;
}

function mockupJobStatusOrFallback(
  data: FirebaseFirestore.DocumentData
): JobStatus {
  const value = data.status;

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

  if (value === "complete" || value === "completed" || value === "success") {
    return "succeeded";
  }

  if (typeof data.completedAt === "string" && data.completedAt.length > 0) {
    return "succeeded";
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

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as T;
}
