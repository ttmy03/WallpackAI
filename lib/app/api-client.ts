import type { ApiResponse } from "@/lib/api-response";

/**
 * Reads a WallPack API response without leaking raw JSON parser failures into
 * user-facing error states when the server returns an empty or non-JSON body.
 */
export async function readApiResponse<T>(
  response: Response
): Promise<ApiResponse<T>> {
  const body = await response.text();

  if (body.trim().length === 0) {
    throw new Error(
      response.ok
        ? "API request returned an empty response."
        : `API request failed with ${formatHttpStatus(
            response
          )} and returned an empty response.`
    );
  }

  let payload: unknown;

  try {
    payload = JSON.parse(body) as unknown;
  } catch {
    const contentType = response.headers.get("content-type");
    const responseType = contentType ? ` (${contentType})` : "";

    throw new Error(
      response.ok
        ? `API request returned invalid JSON${responseType}.`
        : `API request failed with ${formatHttpStatus(
            response
          )} and returned invalid JSON${responseType}.`
    );
  }

  if (!isApiResponse<T>(payload)) {
    throw new Error(
      response.ok
        ? "API request returned an unexpected response format."
        : `API request failed with ${formatHttpStatus(
            response
          )} and returned an unexpected response format.`
    );
  }

  return payload;
}

function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  if (!isRecord(value) || typeof value.ok !== "boolean") {
    return false;
  }

  if (value.ok) {
    return "data" in value && value.error === null;
  }

  if (value.data !== null || !isRecord(value.error)) {
    return false;
  }

  return (
    typeof value.error.code === "string" &&
    typeof value.error.message === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatHttpStatus(response: Response) {
  return response.statusText
    ? `HTTP ${response.status} ${response.statusText}`
    : `HTTP ${response.status}`;
}
