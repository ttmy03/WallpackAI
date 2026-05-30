export const FIRESTORE_COLLECTIONS = {
  users: "users",
  projects: "projects",
  generationJobs: "generationJobs",
  exportJobs: "exportJobs",
  mockupJobs: "mockupJobs",
  artworks: "artworks",
  creditLedgerEntries: "creditLedgerEntries",
  subscriptions: "subscriptions",
  stripeWebhookEvents: "stripeWebhookEvents"
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

export function exportJobDocumentPath(jobId: string) {
  return `${FIRESTORE_COLLECTIONS.exportJobs}/${assertFirestoreDocumentId(
    jobId,
    "jobId"
  )}`;
}

export function mockupJobDocumentPath(jobId: string) {
  return `${FIRESTORE_COLLECTIONS.mockupJobs}/${assertFirestoreDocumentId(
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

export function creditLedgerEntryDocumentPath(entryId: string) {
  return `${FIRESTORE_COLLECTIONS.creditLedgerEntries}/${assertFirestoreDocumentId(
    entryId,
    "entryId"
  )}`;
}

export function subscriptionDocumentPath(subscriptionId: string) {
  return `${FIRESTORE_COLLECTIONS.subscriptions}/${assertFirestoreDocumentId(
    subscriptionId,
    "subscriptionId"
  )}`;
}

export function stripeWebhookEventDocumentPath(eventId: string) {
  return `${FIRESTORE_COLLECTIONS.stripeWebhookEvents}/${assertFirestoreDocumentId(
    eventId,
    "eventId"
  )}`;
}
