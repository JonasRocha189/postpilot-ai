import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { ApiError } from "@/lib/api/http";
import { useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * Delete confirmation. Shows `conflictMessage` when the API answers 409 (the
 * record still has dependents) and a generic message for other errors.
 */
export default function ConfirmDeleteModal({
  isOpen,
  title,
  message,
  conflictMessage,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  conflictMessage?: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}) {
  const { t } = useTranslation("app", { keyPrefix: "deleteDialog" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onClose();
  };

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      close();
    } catch (error) {
      setError(
        error instanceof ApiError && error.status === 409 && conflictMessage
          ? conflictMessage
          : t("failed"),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      className="m-4 max-w-[460px] p-6 sm:p-8"
    >
      <div>
        <h3 className="pe-8 text-lg font-semibold text-gray-800 dark:text-white/90">
          {title}
        </h3>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {message}
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-error-500 bg-error-50 p-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-400"
          >
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" size="sm" onClick={close}>
            {t("cancel")}
          </Button>
          <Button
            size="sm"
            onClick={confirm}
            disabled={pending}
            className="bg-error-500! hover:bg-error-600! disabled:bg-error-300!"
          >
            {pending ? t("deleting") : t("confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
