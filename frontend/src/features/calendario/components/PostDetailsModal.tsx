import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { STATUS_POST_COR } from "@/lib/dominio";
import { useFormat } from "@/lib/format";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { PostAgendado } from "../types";

export default function PostDetailsModal({
  post,
  onClose,
}: {
  post: PostAgendado | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("app");
  const fmt = useFormat();

  return (
    <Modal
      isOpen={post !== null}
      onClose={onClose}
      className="m-4 max-w-[480px] p-6 sm:p-8"
    >
      {post && (
        <div>
          <h3 className="pe-8 text-lg font-semibold text-gray-800 dark:text-white/90">
            {post.title}
          </h3>

          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex gap-3">
              <dt className="w-28 shrink-0 text-gray-500 dark:text-gray-400">
                {t("calendar.details.scheduledFor")}
              </dt>
              <dd className="text-gray-800 first-letter:uppercase dark:text-white/90">
                {fmt.date(post.dataPrevista, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-28 shrink-0 text-gray-500 dark:text-gray-400">
                {t("calendar.details.subject")}
              </dt>
              <dd className="text-gray-800 dark:text-white/90">
                {post.assunto}
              </dd>
            </div>
            <div className="flex items-center gap-3">
              <dt className="w-28 shrink-0 text-gray-500 dark:text-gray-400">
                {t("calendar.details.status")}
              </dt>
              <dd>
                <Badge color={STATUS_POST_COR[post.status]} size="sm">
                  {t(`domain.postStatus.${post.status}`)}
                </Badge>
              </dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>
              {t("common.close")}
            </Button>
            <Link
              to={`/posts/${post.id}`}
              className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600"
            >
              {t("calendar.details.openPost")}
            </Link>
          </div>
        </div>
      )}
    </Modal>
  );
}
