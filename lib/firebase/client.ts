import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import type { Analytics } from "firebase/analytics";

type FirebaseClientEnvKey =
  | "NEXT_PUBLIC_FIREBASE_API_KEY"
  | "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
  | "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
  | "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
  | "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
  | "NEXT_PUBLIC_FIREBASE_APP_ID"
  | "NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID";

type FirebaseClientEnv = Record<string, string | undefined>;

let analyticsPromise: Promise<Analytics | null> | null = null;

const defaultFirebaseClientEnv: FirebaseClientEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

export function getFirebaseClientApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp(getFirebaseClientConfig());
}

export function getFirebaseClientAuth(): Auth {
  return getAuth(getFirebaseClientApp());
}

export function getFirebaseClientStorage(): FirebaseStorage {
  return getStorage(getFirebaseClientApp());
}

export function getFirebaseClientConfig(
  env: FirebaseClientEnv = defaultFirebaseClientEnv
) {
  return {
    apiKey: requireFirebaseEnv(env, "NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: requireFirebaseEnv(env, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: requireFirebaseEnv(env, "NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: requireFirebaseEnv(env, "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: requireFirebaseEnv(
      env,
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
    ),
    appId: requireFirebaseEnv(env, "NEXT_PUBLIC_FIREBASE_APP_ID"),
    measurementId: env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
  };
}

export function getFirebaseClientAnalytics(): Promise<Analytics | null> {
  if (analyticsPromise) {
    return analyticsPromise;
  }

  analyticsPromise = loadAnalytics();
  return analyticsPromise;
}

async function loadAnalytics() {
  if (
    typeof window === "undefined" ||
    !process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
  ) {
    return null;
  }

  const { getAnalytics, isSupported } = await import("firebase/analytics");

  if (!(await isSupported())) {
    return null;
  }

  return getAnalytics(getFirebaseClientApp());
}

function requireFirebaseEnv(env: FirebaseClientEnv, key: FirebaseClientEnvKey) {
  const value = env[key];

  if (!value) {
    throw new Error(`${key} is required to initialize Firebase`);
  }

  return value;
}
