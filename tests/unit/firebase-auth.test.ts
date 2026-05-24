import { describe, expect, it } from "vitest";

import {
  extractBearerToken,
  mapDecodedFirebaseUser
} from "@/lib/auth/firebase-auth";
import {
  GOOGLE_FIREBASE_PROVIDER_ID,
  hasGoogleProvider,
  isGoogleSignInProvider
} from "@/lib/firebase/google-auth";

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

  it("maps Firebase token fields into the session user", () => {
    expect(
      mapDecodedFirebaseUser({
        uid: "firebase-user-1",
        email: "seller@example.com",
        email_verified: true,
        firebase: { sign_in_provider: GOOGLE_FIREBASE_PROVIDER_ID },
        name: "Etsy Seller",
        picture: "https://example.test/avatar.png"
      })
    ).toEqual({
      firebaseUid: "firebase-user-1",
      email: "seller@example.com",
      emailVerified: true,
      signInProvider: GOOGLE_FIREBASE_PROVIDER_ID,
      name: "Etsy Seller",
      picture: "https://example.test/avatar.png"
    });
  });

  it("detects Google Firebase providers", () => {
    expect(isGoogleSignInProvider(GOOGLE_FIREBASE_PROVIDER_ID)).toBe(true);
    expect(isGoogleSignInProvider("password")).toBe(false);
    expect(
      hasGoogleProvider([
        { providerId: "password" },
        { providerId: GOOGLE_FIREBASE_PROVIDER_ID }
      ])
    ).toBe(true);
  });
});
