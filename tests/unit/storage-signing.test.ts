import { describe, expect, it } from "vitest";

import { isStorageSigningConfigurationError } from "@/lib/storage";

describe("Storage signed URL configuration", () => {
  it("detects Firebase local signing credential errors", () => {
    const error = new Error("Cannot sign data without `client_email`.");
    error.name = "SigningError";

    expect(isStorageSigningConfigurationError(error)).toBe(true);
  });

  it("does not hide unrelated storage errors", () => {
    expect(
      isStorageSigningConfigurationError(new Error("bucket not found"))
    ).toBe(false);
  });
});
