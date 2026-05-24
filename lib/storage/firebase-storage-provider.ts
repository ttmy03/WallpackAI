import { getFirebaseStorage } from "@/lib/firebase/admin";
import type {
  DownloadedObject,
  SignedDownloadUrl,
  StorageProvider,
  StoredObject,
  UploadObjectInput
} from "@/lib/storage/storage-provider";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 15 * 60;

export class FirebaseStorageProvider implements StorageProvider {
  async uploadObject(input: UploadObjectInput): Promise<StoredObject> {
    const bucket = getFirebaseStorage().bucket();
    const file = bucket.file(input.path);
    const bytes = Buffer.from(input.bytes);

    await file.save(bytes, {
      resumable: false,
      contentType: input.contentType,
      metadata: {
        metadata: input.metadata
      }
    });

    return {
      path: input.path,
      bucket: bucket.name,
      contentType: input.contentType,
      bytes: bytes.byteLength
    };
  }

  async downloadObject(path: string): Promise<DownloadedObject> {
    const file = getFirebaseStorage().bucket().file(path);
    const [bytes] = await file.download();
    const [metadata] = await file.getMetadata();

    return {
      path,
      bytes,
      contentType:
        typeof metadata.contentType === "string"
          ? metadata.contentType
          : "application/octet-stream"
    };
  }

  async createSignedDownloadUrl(
    path: string,
    options: { ttlSeconds?: number } = {}
  ): Promise<SignedDownloadUrl> {
    const ttlSeconds =
      options.ttlSeconds ??
      readPositiveIntegerEnv(
        "EXPORT_SIGNED_URL_TTL_SECONDS",
        DEFAULT_SIGNED_URL_TTL_SECONDS
      );
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const [url] = await getFirebaseStorage().bucket().file(path).getSignedUrl({
      action: "read",
      expires: expiresAt
    });

    return { url, expiresAt };
  }

  async deleteObject(path: string): Promise<void> {
    await getFirebaseStorage().bucket().file(path).delete({ ignoreNotFound: true });
  }
}

function readPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
