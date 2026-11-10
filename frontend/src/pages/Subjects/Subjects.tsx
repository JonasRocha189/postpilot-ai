import ConfirmDeleteModal from "@/components/common/ConfirmDeleteModal";
import PageHeader from "@/components/common/PageHeader";
import PageMeta from "@/components/common/PageMeta";
import {
  cardClass,
  iconButtonClass,
  iconButtonDangerClass,
  primaryLinkClass,
} from "@/components/common/styles";
import { useSubjects, useDeleteSubject } from "@/features/subjects/api";
import type { Subject } from "@/features/subjects/types";
import { useCurrentProject } from "@/features/projects/useCurrentProject";
import { PencilIcon, PlusIcon, TrashBinIcon } from "@/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

const th =
  "px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400";
const td = "px-5 py-4 align-top text-sm text-gray-600 dark:text-gray-400";

export default function Subjects() {
  const { t } = useTranslation("app", { keyPrefix: "subjects" });
  const { currentProject } = useCurrentProject();
  const {
    data: subjects = [],
    isLoading,
    isError,
  } = useSubjects(currentProject?.id);
  const remove = useDeleteSubject();
  const [toDelete, setToDelete] = useState<Subject | null>(null);

  // The subject's own value, or a note that it comes from the project
  const voice = (value: string | null) =>
    value ? (
      <span className="line-clamp-2">{value}</span>
    ) : (
      <span className="text-gray-400 italic dark:text-gray-500">
        {t("fromProject")}
      </span>
    );

  return (
    <>
      <PageMeta
        title={`${t("title")} | PostPilot`}
        description={t("subtitle")}
      />
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { project: currentProject?.name })}
        action={
          <Link to="/subjects/new" className={primaryLinkClass}>
            <PlusIcon className="size-5" />
            {t("new")}
          </Link>
        }
      />

      {isLoading ? (
        <div
          aria-hidden
          className="h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800"
        />
      ) : isError ? (
        <p role="alert" className="text-sm text-error-600">
          {t("loadError")}
        </p>
      ) : subjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center dark:border-gray-700 dark:bg-white/3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {t("empty.title")}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
            {t("empty.message")}
          </p>
          <Link to="/subjects/new" className={`${primaryLinkClass} mt-6`}>
            <PlusIcon className="size-5" />
            {t("new")}
          </Link>
        </div>
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="max-w-full overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className={th}>{t("columns.name")}</th>
                  <th className={`${th} hidden md:table-cell`}>
                    {t("columns.audience")}
                  </th>
                  <th className={`${th} hidden lg:table-cell`}>
                    {t("columns.tone")}
                  </th>
                  <th className={`${th} text-end`}>
                    <span className="sr-only">{t("columns.actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {subjects.map((subject) => (
                  <tr key={subject.id}>
                    <td className={td}>
                      <Link
                        to={`/subjects/${subject.id}`}
                        className="font-medium text-gray-800 hover:text-brand-500 dark:text-white/90 dark:hover:text-brand-400"
                      >
                        {subject.name}
                      </Link>
                      {subject.description && (
                        <p className="mt-1 line-clamp-2 max-w-md">
                          {subject.description}
                        </p>
                      )}
                    </td>
                    <td className={`${td} hidden max-w-xs md:table-cell`}>
                      {voice(subject.target_audience)}
                    </td>
                    <td className={`${td} hidden max-w-xs lg:table-cell`}>
                      {voice(subject.voice_tone)}
                    </td>
                    <td className={td}>
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/subjects/${subject.id}`}
                          className={iconButtonClass}
                          aria-label={t("editLabel", { name: subject.name })}
                          title={t("edit")}
                        >
                          <PencilIcon className="size-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => setToDelete(subject)}
                          className={iconButtonDangerClass}
                          aria-label={t("deleteLabel", { name: subject.name })}
                          title={t("delete.confirm")}
                        >
                          <TrashBinIcon className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={toDelete !== null}
        title={t("delete.title", { name: toDelete?.name })}
        message={t("delete.message")}
        conflictMessage={t("delete.hasPosts")}
        onConfirm={() => remove.mutateAsync(toDelete!.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
