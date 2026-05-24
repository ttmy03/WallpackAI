import { describe, expect, it } from "vitest";

import {
  getEmailVerificationActionCodeSettings,
  getEmailVerificationContinueUrl
} from "@/lib/firebase/email-verification";

describe("Firebase email verification settings", () => {
  it("uses the configured public app URL for verification return links", () => {
    expect(
      getEmailVerificationContinueUrl("http://localhost:3000", {
        NEXT_PUBLIC_APP_URL: "https://wallpack.example"
      })
    ).toBe("https://wallpack.example/app");
  });

  it("falls back to the current origin", () => {
    expect(getEmailVerificationContinueUrl("http://localhost:3000", {})).toBe(
      "http://localhost:3000/app"
    );
  });

  it("returns Firebase action code settings", () => {
    expect(
      getEmailVerificationActionCodeSettings("http://localhost:3000", {})
    ).toEqual({
      url: "http://localhost:3000/app",
      handleCodeInApp: false
    });
  });
});
