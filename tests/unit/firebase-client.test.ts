import { describe, expect, it } from "vitest";

import { getFirebaseClientConfig } from "@/lib/firebase/client";

describe("Firebase client config", () => {
  it("maps NEXT_PUBLIC Firebase env vars into web SDK config", () => {
    expect(
      getFirebaseClientConfig({
        NEXT_PUBLIC_FIREBASE_API_KEY: "api-key",
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "wallpackai.firebaseapp.com",
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: "wallpackai",
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "wallpackai.firebasestorage.app",
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "352267033614",
        NEXT_PUBLIC_FIREBASE_APP_ID: "app-id",
        NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-TEST"
      })
    ).toEqual({
      apiKey: "api-key",
      authDomain: "wallpackai.firebaseapp.com",
      projectId: "wallpackai",
      storageBucket: "wallpackai.firebasestorage.app",
      messagingSenderId: "352267033614",
      appId: "app-id",
      measurementId: "G-TEST"
    });
  });

  it("throws when required client config is missing", () => {
    expect(() => getFirebaseClientConfig({})).toThrow(
      "NEXT_PUBLIC_FIREBASE_API_KEY"
    );
  });
});
