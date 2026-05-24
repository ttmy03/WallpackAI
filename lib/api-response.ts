export type ApiResponse<T> =
  | { ok: true; data: T; error: null }
  | {
      ok: false;
      data: null;
      error: { code: string; message: string; details?: unknown };
    };

export function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, data, error: null };
}

export function fail(
  code: string,
  message: string,
  details?: unknown
): ApiResponse<never> {
  return { ok: false, data: null, error: { code, message, details } };
}
