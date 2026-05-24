export const ETSY_TARGET_UPLOAD_BYTES = 18 * 1024 * 1024;
export const ETSY_HARD_UPLOAD_BYTES = 20 * 1024 * 1024;
export const ETSY_MAX_UPLOAD_FILES = 5;

export type EtsyExportFile = {
  fileName: string;
  bytes: number;
  kind:
    | "print_jpg"
    | "buyer_pdf"
    | "listing_txt"
    | "tags_csv"
    | "manifest_json"
    | "mockup_jpg"
    | "other";
};

export type EtsyUploadPartition = {
  uploadName: string;
  files: EtsyExportFile[];
  bytes: number;
};

export type EtsyPartitionResult = {
  uploads: EtsyUploadPartition[];
  externalDeliveryNotRecommended: boolean;
  warnings: string[];
};

type PartitionOptions = {
  targetBytes?: number;
  hardBytes?: number;
  maxUploads?: number;
  uploadNamePrefix?: string;
};

export function partitionEtsyUploadFiles(
  files: EtsyExportFile[],
  options: PartitionOptions = {}
): EtsyPartitionResult {
  const targetBytes = options.targetBytes ?? ETSY_TARGET_UPLOAD_BYTES;
  const hardBytes = options.hardBytes ?? ETSY_HARD_UPLOAD_BYTES;
  const maxUploads = options.maxUploads ?? ETSY_MAX_UPLOAD_FILES;
  const uploadNamePrefix = options.uploadNamePrefix ?? "WallPackAI_PrintFiles";
  const warnings: string[] = [];
  const uploads: EtsyUploadPartition[] = [];

  for (const file of files) {
    if (file.bytes > hardBytes) {
      warnings.push(`${file.fileName} is larger than Etsy's 20 MB hard limit.`);
    } else if (file.bytes > targetBytes) {
      warnings.push(`${file.fileName} is above the 18 MB safety target.`);
    }

    const current = uploads.at(-1);
    const canFitCurrent =
      current && current.bytes + file.bytes <= targetBytes && current.files.length > 0;

    if (canFitCurrent) {
      current.files.push(file);
      current.bytes += file.bytes;
      continue;
    }

    uploads.push({
      uploadName: `${uploadNamePrefix}_${uploads.length + 1}.zip`,
      files: [file],
      bytes: file.bytes
    });
  }

  const externalDeliveryNotRecommended = uploads.length > maxUploads;

  if (externalDeliveryNotRecommended) {
    warnings.push(
      `This pack needs ${uploads.length} Etsy upload files; Etsy allows ${maxUploads}.`
    );
  }

  return {
    uploads,
    externalDeliveryNotRecommended,
    warnings
  };
}
