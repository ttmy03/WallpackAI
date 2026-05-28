import { FirebaseStorageProvider } from "@/lib/storage/firebase-storage-provider";
import type {
  SignedDownloadUrl,
  StorageProvider
} from "@/lib/storage/storage-provider";

const DEFAULT_DATA_URL_FALLBACK_MAX_BYTES = 3 * 1024 * 1024;

let storageProvider: StorageProvider | null = null;
let signedUrlConfigurationWarningLogged = false;

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

export async function createOptionalSignedDownloadUrl(
  path: string,
  options?: { ttlSeconds?: number }
): Promise<SignedDownloadUrl | null> {
  try {
    return await getStorageProvider().createSignedDownloadUrl(path, options);
  } catch (error) {
    if (!isStorageSigningConfigurationError(error)) {
      throw error;
    }

    if (!signedUrlConfigurationWarningLogged) {
      signedUrlConfigurationWarningLogged = true;
      console.warn(
        "Firebase Storage signed URLs are unavailable. Set FIREBASE_SERVICE_ACCOUNT_JSON, or set both FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY for local development."
      );
    }

    return null;
  }
}

export async function createOptionalStorageDataUrl(
  path: string,
  options: { maxBytes?: number } = {}
): Promise<string | null> {
  try {
    const maxBytes = options.maxBytes ?? DEFAULT_DATA_URL_FALLBACK_MAX_BYTES;
    const object = await getStorageProvider().downloadObject(path);

    if (object.bytes.byteLength > maxBytes) {
      console.warn(
        `Skipping local data URL fallback for ${path}: ${object.bytes.byteLength} bytes exceeds ${maxBytes} bytes.`
      );

      return null;
    }

    return `data:${object.contentType};base64,${object.bytes.toString("base64")}`;
  } catch (error) {
    console.warn(`Unable to load local data URL fallback for ${path}.`, error);

    return null;
  }
}

export function isStorageSigningConfigurationError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";

  return (
    name === "SigningError" ||
    message.includes("Cannot sign data without `client_email`") ||
    message.includes("Cannot sign data without client_email")
  );
}
