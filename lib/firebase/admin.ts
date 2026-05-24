import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type AppOptions,
  type ServiceAccount
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage, type Storage } from "firebase-admin/storage";

let app: App | null = null;

export function getFirebaseAdminApp(): App {
  if (app) {
    return app;
  }

  const existingApp = getApps()[0];
  if (existingApp) {
    app = existingApp;
    return app;
  }

  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ??
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  const options: AppOptions = {
    credential: getFirebaseCredential()
  };

  if (projectId) {
    options.projectId = projectId;
  }

  if (storageBucket) {
    options.storageBucket = storageBucket;
  }

  app = initializeApp(options);
  return app;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseStorage(): Storage {
  return getStorage(getFirebaseAdminApp());
}

function getFirebaseCredential() {
  const serviceAccount = getServiceAccountFromEnv();

  if (serviceAccount) {
    return cert(serviceAccount);
  }

  return applicationDefault();
}

function getServiceAccountFromEnv(): ServiceAccount | null {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (serviceAccountJson) {
    return parseServiceAccountJson(serviceAccountJson);
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey
  };
}

function parseServiceAccountJson(value: string): ServiceAccount {
  const trimmed = value.trim();
  const json = trimmed.startsWith("{")
    ? trimmed
    : Buffer.from(trimmed, "base64").toString("utf8");
  const parsed = JSON.parse(json) as Record<string, unknown>;

  return {
    projectId: stringFromKey(parsed, "project_id"),
    clientEmail: stringFromKey(parsed, "client_email"),
    privateKey: stringFromKey(parsed, "private_key")
  };
}

function stringFromKey(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON is missing ${key}`);
  }

  return value;
}
