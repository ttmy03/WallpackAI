import { getFirebaseFirestore } from "@/lib/firebase/admin";
import {
  FIRESTORE_COLLECTIONS,
  userDocumentPath
} from "@/lib/firestore/collections";
import { getStorageProvider } from "@/lib/storage";

const DELETE_BATCH_SIZE = 450;

type AccountStorageDocumentData = {
  sourceStoragePath?: unknown;
  previewStoragePath?: unknown;
  artifacts?: unknown;
};

export async function deleteFirestoreAccountData(userId: string) {
  const db = getFirebaseFirestore();
  const [
    projects,
    generationJobs,
    exportJobs,
    artworks,
    creditEntries,
    subscriptions
  ] = await Promise.all([
    listUserDocuments(FIRESTORE_COLLECTIONS.projects, userId),
    listUserDocuments(FIRESTORE_COLLECTIONS.generationJobs, userId),
    listUserDocuments(FIRESTORE_COLLECTIONS.exportJobs, userId),
    listUserDocuments(FIRESTORE_COLLECTIONS.artworks, userId),
    listUserDocuments(FIRESTORE_COLLECTIONS.creditLedgerEntries, userId),
    listUserDocuments(FIRESTORE_COLLECTIONS.subscriptions, userId)
  ]);
  const userDocuments = [
    ...projects,
    ...generationJobs,
    ...exportJobs,
    ...artworks,
    ...creditEntries,
    ...subscriptions
  ];
  const storagePaths = accountStoragePathsFromDocuments(
    [...artworks, ...exportJobs].map((doc) => doc.data())
  );

  await Promise.all(
    storagePaths.map((path) =>
      getStorageProvider()
        .deleteObject(path)
        .catch(() => undefined)
    )
  );

  await deleteDocumentsInBatches([
    ...userDocuments.map((doc) => doc.ref),
    db.doc(userDocumentPath(userId))
  ]);

  return {
    firestoreDocumentsDeleted: userDocuments.length + 1,
    storageObjectsDeleted: storagePaths.length
  };
}

export function accountStoragePathsFromDocuments(
  documents: AccountStorageDocumentData[]
) {
  return [
    ...new Set(
      documents.flatMap((data) => [
        nullableString(data.sourceStoragePath),
        nullableString(data.previewStoragePath),
        ...artifactStoragePaths(data.artifacts)
      ])
    )
  ].filter(
    (path): path is string => typeof path === "string" && path.length > 0
  );
}

async function listUserDocuments(collection: string, userId: string) {
  const snapshot = await getFirebaseFirestore()
    .collection(collection)
    .where("userId", "==", userId)
    .get();

  return snapshot.docs;
}

async function deleteDocumentsInBatches(
  refs: FirebaseFirestore.DocumentReference[]
) {
  const db = getFirebaseFirestore();

  for (let index = 0; index < refs.length; index += DELETE_BATCH_SIZE) {
    const batch = db.batch();

    for (const ref of refs.slice(index, index + DELETE_BATCH_SIZE)) {
      batch.delete(ref);
    }

    await batch.commit();
  }
}

function artifactStoragePaths(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((artifact) =>
      typeof artifact === "object" &&
      artifact !== null &&
      typeof (artifact as { storagePath?: unknown }).storagePath === "string"
        ? (artifact as { storagePath: string }).storagePath
        : null
    )
    .filter((path): path is string => typeof path === "string");
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}
