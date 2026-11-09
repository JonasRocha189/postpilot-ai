import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/lib/auth/useAuth";
import { useIdleLogout } from "@/lib/auth/useIdleLogout";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

/** Logs the user out after 30 minutes idle, with a warning in the last minute. */
export default function IdleLogout() {
  const { t } = useTranslation("app", { keyPrefix: "auth.idle" });
  const { logout } = useAuth();
  const onTimeout = useCallback(() => void logout(), [logout]);
  const { warning, secondsLeft, stayActive } = useIdleLogout(onTimeout);

  return (
    <Modal
      isOpen={warning}
      onClose={stayActive}
      showCloseButton={false}
      className="m-4 max-w-md p-6"
    >
      <div role="alertdialog" aria-labelledby="idle-title">
        <h2
          id="idle-title"
          className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90"
        >
          {t("title")}
        </h2>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          {t("text", { seconds: secondsLeft })}
        </p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => void logout()}>
            {t("logoutNow")}
          </Button>
          <Button onClick={stayActive}>{t("stay")}</Button>
        </div>
      </div>
    </Modal>
  );
}
