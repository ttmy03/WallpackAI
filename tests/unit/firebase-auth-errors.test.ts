import { describe, expect, it } from "vitest";

import { getFriendlyFirebaseAuthError } from "@/lib/firebase/auth-errors";

describe("Firebase Auth error messages", () => {
  it("explains disabled email/password auth", () => {
    expect(
      getFriendlyFirebaseAuthError({ code: "auth/operation-not-allowed" })
    ).toBe("Email/password sign-in is not enabled in Firebase Authentication.");
  });

  it("explains unauthorized domains", () => {
    expect(
      getFriendlyFirebaseAuthError({ code: "auth/unauthorized-domain" })
    ).toBe("This domain is not authorized in Firebase Authentication.");
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
