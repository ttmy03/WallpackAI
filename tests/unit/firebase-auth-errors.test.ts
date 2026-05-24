import { describe, expect, it } from "vitest";

import { getFriendlyFirebaseAuthError } from "@/lib/firebase/auth-errors";

describe("Firebase Auth error messages", () => {
  it("explains disabled Google auth", () => {
    expect(
      getFriendlyFirebaseAuthError({ code: "auth/operation-not-allowed" })
    ).toBe("Google sign-in is not enabled in Firebase Authentication.");
  });

  it("explains interrupted Google popups", () => {
    expect(
      getFriendlyFirebaseAuthError({ code: "auth/popup-closed-by-user" })
    ).toBe("Google sign-in was closed before completion.");
  });

  it("explains unauthorized domains", () => {
    expect(
      getFriendlyFirebaseAuthError({ code: "auth/unauthorized-domain" })
    ).toBe("This domain is not authorized in Firebase Authentication.");
  });

  it("explains unauthorized Firebase Auth return URLs", () => {
    expect(
      getFriendlyFirebaseAuthError({ code: "auth/unauthorized-continue-uri" })
    ).toBe("The Firebase Auth return URL is not authorized.");
  });

  it("keeps unknown Firebase error codes visible", () => {
    expect(getFriendlyFirebaseAuthError({ code: "auth/example-failure" })).toBe(
      "Firebase could not complete this request (auth/example-failure)."
    );
  });

  it("explains missing public Firebase env vars", () => {
    expect(
      getFriendlyFirebaseAuthError(
        new Error(
          "NEXT_PUBLIC_FIREBASE_API_KEY is required to initialize Firebase"
        )
      )
    ).toBe(
      "Firebase client config is missing. Restart the dev server after changing .env."
    );
  });
});
