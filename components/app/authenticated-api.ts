"use client";

import type { ApiResponse } from "@/lib/api-response";
import { getFirebaseClientAuth } from "@/lib/firebase/client";

export async function fetchAuthenticatedApi<T>(
  input: string,
  init: RequestInit = {}
): Promise<T> {
  const user = getFirebaseClientAuth().currentUser;

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
  const payload = (await response.json()) as ApiResponse<T>;

  if (!payload.ok) {
    throw new Error(payload.error.message);
  }

  return payload.data;
}
