import { describe, expect, it } from "vitest";

import { getSafeEmailActionRedirect } from "@/lib/firebase/email-action-redirect";

describe("Firebase email action redirect safety", () => {
  it("keeps same-origin continue URLs", () => {
    expect(
      getSafeEmailActionRedirect(
        "https://wallpack.example/app?verified=1",
        "https://wallpack.example"
      )
    ).toBe("/app?verified=1");
  });

  it("falls back for cross-origin continue URLs", () => {
    expect(
      getSafeEmailActionRedirect(
        "https://example.org/app",
        "https://wallpack.example"
      )
    ).toBe("/app");
  });

  it("falls back for missing continue URLs", () => {
    expect(getSafeEmailActionRedirect(null, "https://wallpack.example")).toBe(
      "/app"
    );
  });
});
