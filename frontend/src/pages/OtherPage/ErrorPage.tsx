import GridShape from "@/components/common/GridShape";
import PageMeta from "@/components/common/PageMeta";
import Button from "@/components/ui/button/Button";
import { LockIcon } from "@/icons";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  isRouteErrorResponse,
  Link,
  useRouteError,
  useSearchParams,
} from "react-router";

type ErrorInfo = {
  title: string;
  message: string;
  detail?: string;
  retry: "login" | "reload";
};

// Auth0 codes with their own message in locales/*/app.json (error.authCodes)
const KNOWN_AUTH_CODES = [
  "access_denied",
  "login_required",
  "consent_required",
];

function describeError(
  t: TFunction<"app", "error">,
  routeError: unknown,
  params: URLSearchParams,
): ErrorInfo {
  // 1. Authentication error from Auth0 (/erro?origem=auth&error=...)
  if (params.get("origem") === "auth") {
    const code = params.get("error") ?? "";
    return {
      title: t("authTitle"),
      message: KNOWN_AUTH_CODES.includes(code)
        ? t(`authCodes.${code}`)
        : (params.get("error_description") ?? t("authGeneric")),
      detail: code || undefined,
      retry: "login",
    };
  }

  // 2. Route error (the router's errorElement)
  if (isRouteErrorResponse(routeError)) {
    return {
      title: t("routeTitle", { status: routeError.status }),
      message: routeError.statusText || t("routeMessage"),
      retry: "reload",
    };
  }

  // 3. Unexpected failure; the technical detail shows only in development
  return {
    title: t("unexpectedTitle"),
    message: t("unexpectedMessage"),
    detail:
      import.meta.env.DEV && routeError instanceof Error
        ? routeError.message
        : undefined,
    retry: "reload",
  };
}

export default function ErrorPage() {
  const { t } = useTranslation("app", { keyPrefix: "error" });
  const routeError = useRouteError();
  const [params] = useSearchParams();
  const info = describeError(t, routeError, params);

  return (
    <>
      <PageMeta
        title={`${t("metaTitle")} | PostPilot`}
        description={info.message}
      />
      <div className="relative z-1 flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white p-6 dark:bg-gray-900">
        <GridShape />
        <div className="mx-auto w-full max-w-lg text-center">
          {info.retry === "login" ? (
            <span className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-error-50 text-error-500 dark:bg-error-500/15">
              <LockIcon className="size-8" />
            </span>
          ) : (
            <div className="mx-auto mb-8 max-w-60.5 sm:max-w-80">
              <img src="/images/error/500.svg" alt="" className="dark:hidden" />
              <img
                src="/images/error/500-dark.svg"
                alt=""
                className="hidden dark:block"
              />
            </div>
          )}

          <h1 className="text-title-sm font-bold text-gray-800 sm:text-title-md dark:text-white/90">
            {info.title}
          </h1>

          <p className="mt-4 mb-2 text-base text-gray-700 sm:text-lg dark:text-gray-400">
            {info.message}
          </p>
          {info.detail && (
            <p className="font-mono mb-6 text-xs break-words text-gray-500 dark:text-gray-500">
              {info.detail}
            </p>
          )}

          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            {info.retry === "login" ? (
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-5 py-3.5 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600"
              >
                {t("retryLogin")}
              </Link>
            ) : (
              <Button onClick={() => window.location.reload()}>
                {t("retry")}
              </Button>
            )}
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/3 dark:hover:text-gray-200"
            >
              {t("goDashboard")}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
