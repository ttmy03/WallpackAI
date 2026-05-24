import { describe, expect, it } from "vitest";

import {
  ETSY_MAX_UPLOAD_FILES,
  ETSY_TARGET_UPLOAD_BYTES,
  partitionEtsyUploadFiles,
  type EtsyExportFile
} from "@/lib/etsy/file-partition";

const mb = 1024 * 1024;

describe("Etsy upload file partitioning", () => {
  it("keeps a normal five-ratio pack inside five Etsy upload files", () => {
    const files: EtsyExportFile[] = [
      file("2x3.jpg", 17 * mb),
      file("3x4.jpg", 17 * mb),
      file("4x5.jpg", 17 * mb),
      file("5x7.jpg", 17 * mb),
      file("11x14.jpg", 17 * mb)
    ];

    const result = partitionEtsyUploadFiles(files);

    expect(result.uploads).toHaveLength(ETSY_MAX_UPLOAD_FILES);
    expect(result.externalDeliveryNotRecommended).toBe(false);
    expect(result.uploads.every((upload) => upload.bytes <= ETSY_TARGET_UPLOAD_BYTES)).toBe(
      true
    );
  });

  it("marks external delivery when Etsy upload count would exceed five", () => {
    const files = Array.from({ length: 6 }, (_, index) =>
      file(`ratio-${index}.jpg`, 17 * mb)
    );

    const result = partitionEtsyUploadFiles(files);

    expect(result.uploads).toHaveLength(6);
    expect(result.externalDeliveryNotRecommended).toBe(true);
    expect(result.warnings.join(" ")).toContain("Etsy allows 5");
  });

  it("warns before a single file reaches Etsy's hard limit", () => {
    const result = partitionEtsyUploadFiles([file("huge.jpg", 19 * mb)]);

    expect(result.warnings.join(" ")).toContain("18 MB safety target");
  });
});

function file(fileName: string, bytes: number): EtsyExportFile {
  return { fileName, bytes, kind: "print_jpg" };
}
