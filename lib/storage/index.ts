import { FirebaseStorageProvider } from "@/lib/storage/firebase-storage-provider";
import type { StorageProvider } from "@/lib/storage/storage-provider";

let storageProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (storageProvider) {
    return storageProvider;
  }

  const provider = process.env.STORAGE_PROVIDER ?? "firebase";

  if (provider !== "firebase") {
    throw new Error(`Unsupported STORAGE_PROVIDER: ${provider}`);
  }

  storageProvider = new FirebaseStorageProvider();
  return storageProvider;
}
