export const auth0Config = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN ?? "",
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID ?? "",
  audience: import.meta.env.VITE_AUTH0_AUDIENCE || undefined,
  dbConnection:
    import.meta.env.VITE_AUTH0_DB_CONNECTION ||
    "Username-Password-Authentication",
};

/**
 * - `auth0`: Auth0 configured (development or production)
 * - `mock`: only in `npm run dev` without Auth0 configured; a fake user
 * - `missing`: production build without Auth0 configured; login unavailable
 */
export type AuthMode = "auth0" | "mock" | "missing";

export const authMode: AuthMode =
  auth0Config.domain && auth0Config.clientId
    ? "auth0"
    : import.meta.env.DEV
      ? "mock"
      : "missing";

export const DEFAULT_RETURN_TO = "/dashboard";
