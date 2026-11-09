import i18n from "@/i18n";
import { useAuth0 } from "@auth0/auth0-react";
import { auth0Config, authMode, DEFAULT_RETURN_TO } from "./config";
import { clearActivity, markActivity } from "./idle";

export type AuthUser = {
  sub?: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
  updated_at?: string;
};

export type AuthState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  user?: AuthUser;
  error?: Error;
  login: (returnTo?: string) => Promise<void>;
  signup: (returnTo?: string) => Promise<void>;
  logout: () => Promise<void>;
};

// ---------------------------------------------------------------------------
// Modo mock: sessão fictícia guardada no sessionStorage (só em `npm run dev`)
// ---------------------------------------------------------------------------

const MOCK_SESSION_KEY = "postpilot:mock-session";

const mockUser = (): AuthUser => ({
  sub: "auth0|mock-user",
  name: i18n.t("app:auth.mockUserName"),
  email: "teste@postpilot.dev",
  email_verified: true,
});

function readMockSession(): boolean {
  try {
    return sessionStorage.getItem(MOCK_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMockSession(loggedIn: boolean) {
  try {
    if (loggedIn) sessionStorage.setItem(MOCK_SESSION_KEY, "1");
    else sessionStorage.removeItem(MOCK_SESSION_KEY);
  } catch {
    // sessionStorage indisponível: a sessão fictícia dura só esta página
  }
}

function mockAuthState(): AuthState {
  const isAuthenticated = readMockSession();
  const enter = async (returnTo = DEFAULT_RETURN_TO) => {
    writeMockSession(true);
    markActivity();
    window.location.assign(returnTo);
  };
  return {
    isLoading: false,
    isAuthenticated,
    user: isAuthenticated ? mockUser() : undefined,
    login: enter,
    signup: enter,
    logout: async () => {
      writeMockSession(false);
      clearActivity();
      window.location.assign("/login");
    },
  };
}

const missingConfigError = () => new Error(i18n.t("app:auth.missingConfig"));

function missingAuthState(): AuthState {
  const error = missingConfigError();
  return {
    isLoading: false,
    isAuthenticated: false,
    error,
    login: () => Promise.reject(error),
    signup: () => Promise.reject(error),
    logout: async () => window.location.assign("/login"),
  };
}

// ---------------------------------------------------------------------------

/** Estado de autenticação da aplicação. Use sempre este hook, nunca o useAuth0 direto. */
export function useAuth(): AuthState {
  const auth0 = useAuth0<AuthUser>();

  if (authMode === "mock") return mockAuthState();
  if (authMode === "missing") return missingAuthState();

  return {
    isLoading: auth0.isLoading,
    isAuthenticated: auth0.isAuthenticated,
    user: auth0.user,
    error: auth0.error,
    login: (returnTo = DEFAULT_RETURN_TO) =>
      auth0.loginWithRedirect({ appState: { returnTo } }),
    signup: (returnTo = DEFAULT_RETURN_TO) =>
      auth0.loginWithRedirect({
        appState: { returnTo },
        authorizationParams: { screen_hint: "signup" },
      }),
    logout: () => {
      clearActivity();
      return auth0.logout({
        logoutParams: { returnTo: `${window.location.origin}/login` },
      });
    },
  };
}

/** Usuários de login social (Google etc.) não têm senha no Auth0. */
export function hasPassword(user?: AuthUser): boolean {
  return Boolean(user?.sub?.startsWith("auth0|"));
}

/**
 * Pede ao Auth0 que envie o e-mail de redefinição de senha.
 * Exige a origem do app em "Allowed Origins (CORS)" da aplicação no Auth0.
 */
export async function requestPasswordChange(email: string): Promise<void> {
  if (authMode === "mock") return;
  if (authMode === "missing") throw missingConfigError();

  const response = await fetch(
    `https://${auth0Config.domain}/dbconnections/change_password`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: auth0Config.clientId,
        email,
        connection: auth0Config.dbConnection,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(i18n.t("app:profile.passwordError"));
  }
}
