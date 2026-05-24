import { describe, expect, it } from "vitest";

import { extractBearerToken } from "@/lib/auth/firebase-auth";

describe("Firebase auth helpers", () => {
  it("extracts bearer tokens from API requests", () => {
    const request = new Request("https://example.test", {
      headers: { authorization: "Bearer token_123" }
    });

    expect(extractBearerToken(request)).toBe("token_123");
  });

  it("returns null when no bearer token is present", () => {
    const request = new Request("https://example.test");

    expect(extractBearerToken(request)).toBeNull();
  });
});
