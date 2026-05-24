export type UploadObjectInput = {
  path: string;
  bytes: Buffer | Uint8Array;
  contentType: string;
  metadata?: Record<string, string>;
};

export type StoredObject = {
  path: string;
  bucket: string;
  contentType: string;
  bytes: number;
};

export type DownloadedObject = {
  path: string;
  bytes: Buffer;
  contentType: string;
};

export type SignedDownloadUrl = {
  url: string;
  expiresAt: Date;
};

export interface StorageProvider {
  uploadObject(input: UploadObjectInput): Promise<StoredObject>;
  downloadObject(path: string): Promise<DownloadedObject>;
  createSignedDownloadUrl(
    path: string,
    options?: { ttlSeconds?: number }
  ): Promise<SignedDownloadUrl>;
  deleteObject(path: string): Promise<void>;
}
