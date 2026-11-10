import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import UserAvatar from "@/components/common/UserAvatar";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { authMode } from "@/lib/auth/config";
import {
  hasPassword,
  requestPasswordChange,
  useAuth,
  type AuthUser,
} from "@/lib/auth/useAuth";
import { useState } from "react";
import { useTranslation } from "react-i18next";

// Service names: the same in every language (except "auth0", translated)
const PROVIDERS: Record<string, string> = {
  "google-oauth2": "Google",
  github: "GitHub",
  windowslive: "Microsoft",
  linkedin: "LinkedIn",
};

const cardClass =
  "rounded-2xl border border-gray-200 bg-white p-5 lg:p-6 dark:border-gray-800 dark:bg-white/3";

type PasswordStatus =
  | { state: "idle" }
  | { state: "sending" }
  | { state: "sent" }
  | { state: "error"; message: string };

export default function Profile() {
  const { t } = useTranslation("app", { keyPrefix: "profile" });
  const { user, logout } = useAuth();
  const [password, setPassword] = useState<PasswordStatus>({ state: "idle" });

  const loginMethod = (u?: AuthUser): string => {
    const provider = u?.sub?.split("|")[0] ?? "";
    if (provider === "auth0") return t("methods.auth0");
    return PROVIDERS[provider] ?? provider;
  };

  const handlePasswordChange = async () => {
    if (!user?.email) return;
    setPassword({ state: "sending" });
    try {
      await requestPasswordChange(user.email);
      setPassword({ state: "sent" });
    } catch (err) {
      setPassword({
        state: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <>
      <PageMeta
        title={`${t("title")} | PostPilot`}
        description={t("metaDescription")}
      />
      <PageBreadcrumb pageTitle={t("title")} />

      <div className="space-y-6">
        {/* User data */}
        <section className={cardClass}>
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-start">
            <UserAvatar user={user} />
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                {user?.name ?? t("fallbackName")}
              </h3>
              <p className="mt-1 text-sm break-all text-gray-500 dark:text-gray-400">
                {user?.email}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                {user?.email_verified ? (
                  <Badge color="success" size="sm">
                    {t("emailVerified")}
                  </Badge>
                ) : (
                  <Badge color="warning" size="sm">
                    {t("emailNotVerified")}
                  </Badge>
                )}
                <Badge color="light" size="sm">
                  {t("accessVia", { method: loginMethod(user) })}
                </Badge>
              </div>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className={cardClass}>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {t("security")}
          </h3>

          {hasPassword(user) ? (
            <>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {t("passwordIntro")}{" "}
                <strong className="font-medium text-gray-700 dark:text-gray-300">
                  {user?.email}
                </strong>
                .
              </p>
              <div className="mt-5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePasswordChange}
                  disabled={password.state === "sending" || !user?.email}
                >
                  {password.state === "sending"
                    ? t("sending")
                    : t("changePassword")}
                </Button>
              </div>
              {password.state === "sent" && (
                <p role="status" className="mt-4 text-sm text-success-600">
                  {t("passwordSent")}
                  {authMode === "mock" && ` ${t("simulated")}`}
                </p>
              )}
              {password.state === "error" && (
                <p role="alert" className="mt-4 text-sm text-error-600">
                  {password.message}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {t("socialPassword", { method: loginMethod(user) })}
            </p>
          )}
        </section>

        {/* Session */}
        <section className={cardClass}>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {t("session")}
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t("sessionText")}
          </p>
          <div className="mt-5">
            <Button variant="outline" size="sm" onClick={() => void logout()}>
              {t("logout")}
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
