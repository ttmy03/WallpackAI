export const FIRESTORE_COLLECTIONS = {
  users: "users",
  projects: "projects",
  generationJobs: "generationJobs",
  artworks: "artworks",
  creditLedgerEntries: "creditLedgerEntries"
} as const;

export function assertFirestoreDocumentId(value: string, label: string) {
  if (!value || value.includes("/")) {
    throw new Error(`${label} must be a non-empty Firestore document id`);
  }

  return value;
}

export function userDocumentPath(firebaseUid: string) {
  return `${FIRESTORE_COLLECTIONS.users}/${assertFirestoreDocumentId(
    firebaseUid,
    "firebaseUid"
  )}`;
}

export function projectDocumentPath(projectId: string) {
  return `${FIRESTORE_COLLECTIONS.projects}/${assertFirestoreDocumentId(
    projectId,
    "projectId"
  )}`;
}

export function generationJobDocumentPath(jobId: string) {
  return `${FIRESTORE_COLLECTIONS.generationJobs}/${assertFirestoreDocumentId(
    jobId,
    "jobId"
  )}`;
}

export function artworkDocumentPath(artworkId: string) {
  return `${FIRESTORE_COLLECTIONS.artworks}/${assertFirestoreDocumentId(
    artworkId,
    "artworkId"
  )}`;
}
