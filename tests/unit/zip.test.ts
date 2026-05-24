import { describe, expect, it } from "vitest";

import { createZipArchive } from "@/lib/export/zip";

describe("ZIP archive builder", () => {
  it("creates a standard ZIP payload with local and central directory records", () => {
    const zip = createZipArchive([
      { path: "print-files/2x3.jpg", bytes: Buffer.from([1, 2, 3]) },
      { path: "listing-copy.txt", bytes: Buffer.from("Listing copy", "utf8") }
    ]);

    expect(zip.subarray(0, 4).toString("hex")).toBe("504b0304");
    expect(zip.includes(Buffer.from("print-files/2x3.jpg"))).toBe(true);
    expect(zip.includes(Buffer.from("listing-copy.txt"))).toBe(true);
    expect(zip.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06]))).toBe(true);
  });
});
