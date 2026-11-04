/**
 * - `http`: chama o backend (`VITE_API_URL` ou a mesma origem em produção)
 * - `mock`: só em `npm run dev` sem `VITE_API_URL`; dados no localStorage
 */
export type ApiMode = "http" | "mock";

export const apiMode: ApiMode =
  import.meta.env.VITE_API_URL || !import.meta.env.DEV ? "http" : "mock";

const baseUrl = `${import.meta.env.VITE_API_URL ?? ""}/api/v1`;

/** Erro da API no formato `{"detail": ...}` do FastAPI. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Registrado pelo AuthProvider; devolve o access token do Auth0
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
      // corpo vazio ou não-JSON
    }
    throw new ApiError(
      response.status,
      typeof detail === "string" ? detail : response.statusText,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
