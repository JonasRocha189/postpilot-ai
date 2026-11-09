import Button from "@/components/ui/button/Button";
import { authMode, DEFAULT_RETURN_TO } from "@/lib/auth/config";
import { clearIdleLogoutFlag, wasIdleLogout } from "@/lib/auth/idle";
import { useAuth } from "@/lib/auth/useAuth";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation } from "react-router";
import LoadingScreen from "./LoadingScreen";

type Mode = "login" | "signup";

const SWITCH_TO: Record<Mode, string> = {
  login: "/signup",
  signup: "/login",
};

/** Monta a URL de /erro a partir do erro devolvido pelo Auth0. */
function errorUrl(error: Error): string {
  const { error: code, error_description: description } = error as Error & {
    error?: string;
    error_description?: string;
  };
  const params = new URLSearchParams({
    origem: "auth",
    error: code ?? "auth_error",
    error_description: description ?? error.message,
  });
  return `/error?${params}`;
}

export default function AuthEntry({ mode }: { mode: Mode }) {
  const { t } = useTranslation("app", { keyPrefix: "auth" });
  const { isLoading, isAuthenticated, error, login, signup } = useAuth();
  const location = useLocation();
  const [redirecting, setRedirecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [idleLogout] = useState(wasIdleLogout);

  // Show the reason once: a later visit to /login starts clean
  useEffect(() => {
    if (idleLogout) clearIdleLogoutFlag();
  }, [idleLogout]);

  const returnTo =
    (location.state as { from?: string } | null)?.from ?? DEFAULT_RETURN_TO;

  // Erro no retorno do Auth0 (ex.: acesso negado). Só redireciona quando o erro
  // veio na URL; senão "tentar novamente" em /erro voltaria direto para /erro.
  const returnedWithError = new URLSearchParams(location.search).has("error");
  if (error && authMode === "auth0" && returnedWithError) {
    return <Navigate to={errorUrl(error)} replace />;
  }
  if (isLoading) return <LoadingScreen message={t("checkingSession")} />;
  if (isAuthenticated) return <Navigate to={returnTo} replace />;

  const handleClick = async () => {
    setRedirecting(true);
    setActionError(null);
    try {
      await (mode === "login" ? login(returnTo) : signup(returnTo));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
      setRedirecting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="mb-5 sm:mb-8">
          <h1 className="mb-2 text-title-sm font-semibold text-gray-800 sm:text-title-md dark:text-white/90">
            {t(`${mode}.title`)}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t(`${mode}.description`)}
          </p>
        </div>

        {authMode === "mock" && (
          <p className="mb-5 rounded-lg border border-warning-500 bg-warning-50 p-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/15 dark:text-orange-400">
            <strong>{t("devModeTitle")}</strong>{" "}
            {t("devModeText", { file: ".env.example" })}
          </p>
        )}

        {idleLogout && (
          <p
            role="status"
            className="mb-5 rounded-lg border border-brand-300 bg-brand-50 p-3 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-400"
          >
            {t("idle.loggedOut")}
          </p>
        )}

        {(authMode === "missing" || actionError) && (
          <p
            role="alert"
            className="mb-5 rounded-lg border border-error-500 bg-error-50 p-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-400"
          >
            {actionError ?? error?.message}
          </p>
        )}

        <Button
          className="w-full"
          onClick={handleClick}
          disabled={redirecting || authMode === "missing"}
        >
          {redirecting ? t("redirecting") : t(`${mode}.action`)}
        </Button>

        {authMode === "auth0" && (
          <p className="mt-3 text-center text-xs text-gray-500 dark:text-gray-400">
            {t("auth0Hint")}
          </p>
        )}

        <p className="mt-6 text-center text-sm text-gray-700 dark:text-gray-400">
          {t(`${mode}.switchText`)}{" "}
          <Link
            to={SWITCH_TO[mode]}
            state={location.state}
            className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            {t(`${mode}.switchLink`)}
          </Link>
        </p>
      </div>
    </div>
  );
}
