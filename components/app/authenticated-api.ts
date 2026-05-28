"use client";

import { onAuthStateChanged, type User } from "firebase/auth";

import { readApiResponse } from "@/lib/app/api-client";
import type { ApiResponse } from "@/lib/api-response";
import { getFirebaseClientAuth } from "@/lib/firebase/client";

export type AuthenticatedBlobResponse = {
  blob: Blob;
  fileName: string | null;
};

export async function fetchAuthenticatedApi<T>(
  input: string,
  init: RequestInit = {}
): Promise<T> {
  const user = await getReadyFirebaseUser();

  if (!user) {
    throw new Error("Sign in before loading app data.");
  }

  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    headers
  });
  const payload: ApiResponse<T> = await readApiResponse(response);

  if (!payload.ok) {
    throw new Error(payload.error.message);
  }

  return payload.data;
}

export async function fetchAuthenticatedBlob(
  input: string,
  init: RequestInit = {}
): Promise<AuthenticatedBlobResponse> {
  const user = await getReadyFirebaseUser();

  if (!user) {
    throw new Error("Sign in before downloading files.");
  }

  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(input, {
    ...init,
    headers
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type");

    if (contentType?.includes("application/json")) {
      const payload: ApiResponse<never> = await readApiResponse(response);

      if (!payload.ok) {
        throw new Error(payload.error.message);
      }
    }

    throw new Error(`Download failed with ${formatHttpStatus(response)}.`);
  }

  return {
    blob: await response.blob(),
    fileName: fileNameFromContentDisposition(
      response.headers.get("content-disposition")
    )
  };
}

async function getReadyFirebaseUser(): Promise<User | null> {
  const auth = getFirebaseClientAuth();

  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise((resolve, reject) => {
    let unsubscribe: (() => void) | null = null;

    unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe?.();
        resolve(user);
      },
      (error) => {
        unsubscribe?.();
        reject(error);
      }
    );
  });
}

function fileNameFromContentDisposition(header: string | null) {
  if (!header) {
    return null;
  }

  const encodedMatch = /filename\*=UTF-8''([^;]+)/i.exec(header);

  if (encodedMatch) {
    try {
      return decodeURIComponent(encodedMatch[1]);
    } catch {
      return encodedMatch[1];
    }
  }

  const quotedMatch = /filename="([^"]+)"/i.exec(header);

  if (quotedMatch) {
    return quotedMatch[1];
  }

  const plainMatch = /filename=([^;]+)/i.exec(header);

  return plainMatch?.[1]?.trim() ?? null;
}

function formatHttpStatus(response: Response) {
  return response.statusText
    ? `HTTP ${response.status} ${response.statusText}`
    : `HTTP ${response.status}`;
}
