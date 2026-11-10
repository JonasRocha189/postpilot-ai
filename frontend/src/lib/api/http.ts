/**
 * - `http`: calls the backend (`VITE_API_URL`, or the same origin in production)
 * - `mock`: only in `npm run dev` without `VITE_API_URL`; data in localStorage
 */
export type ApiMode = "http" | "mock";

export const apiMode: ApiMode =
  import.meta.env.VITE_API_URL || !import.meta.env.DEV ? "http" : "mock";

/** Base of every API call (exported for requests outside `apiFetch`, like the health check). */
export const API_BASE_URL = `${import.meta.env.VITE_API_URL ?? ""}/api/v1`;
const baseUrl = API_BASE_URL;

/** API error in FastAPI's `{"detail": ...}` format. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Registered by AuthProvider; returns the Auth0 access token
type TokenGetter = () => Promise<string | undefined>;

let tokenGetter: TokenGetter | null = null;

export function setTokenGetter(getter: TokenGetter | null) {
  tokenGetter = getter;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = tokenGetter ? await tokenGetter() : null;

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    let detail: unknown;
    try {
      detail = (await response.json()).detail;
    } catch {
      // empty or non-JSON body
    }
    throw new ApiError(
      response.status,
      typeof detail === "string" ? detail : response.statusText,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
