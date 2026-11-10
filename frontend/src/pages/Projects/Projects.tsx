import PageMeta from "@/components/common/PageMeta";
import Badge from "@/components/ui/badge/Badge";
import DeleteProjectModal from "@/features/projects/components/DeleteProjectModal";
import ProjectAvatar from "@/features/projects/components/ProjectAvatar";
import type { Project } from "@/features/projects/types";
import { useCurrentProject } from "@/features/projects/useCurrentProject";
import { PencilIcon, PlusIcon, TrashBinIcon } from "@/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

const primaryLink =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white shadow-theme-xs hover:bg-brand-600";
const iconButton =
  "flex size-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white";

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="mt-0.5 line-clamp-2 text-sm text-gray-700 dark:text-gray-300">
        {value}
      </dd>
    </div>
  );
}

export default function Projects() {
  const { t } = useTranslation("app", { keyPrefix: "projects" });
  const { projects, currentProject, select, isLoading, isError } =
    useCurrentProject();
  const [toDelete, setToDelete] = useState<Project | null>(null);

  return (
    <>
      <PageMeta
        title={`${t("title")} | PostPilot`}
        description={t("subtitle")}
      />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            {t("title")}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("subtitle")}
          </p>
        </div>
        <Link to="/projects/new" className={primaryLink}>
          <PlusIcon className="size-5" />
          {t("new")}
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              aria-hidden
              className="h-52 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800"
            />
          ))}
        </div>
      ) : isError ? (
        <p
          role="alert"
          className="rounded-2xl border border-error-500 bg-error-50 p-5 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-400"
        >
          {t("loadError")}
        </p>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center dark:border-gray-700 dark:bg-white/3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {t("empty.title")}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
            {t("empty.message")}
          </p>
          <Link to="/projects/new" className={`${primaryLink} mt-6`}>
            <PlusIcon className="size-5" />
            {t("createFirst")}
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
          {projects.map((project) => {
            const isCurrent = project.id === currentProject?.id;
            return (
              <li
                key={project.id}
                className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3"
              >
                <div className="flex items-start gap-3">
                  <ProjectAvatar
                    project={project}
                    className="size-10 text-base"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-gray-800 dark:text-white/90">
                      {project.name}
                    </h3>
                    {isCurrent && (
                      <span className="mt-1 inline-block">
                        <Badge color="primary" size="sm">
                          {t("currentBadge")}
                        </Badge>
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link
                      to={`/projects/${project.id}`}
                      className={iconButton}
                      aria-label={t("editLabel", { name: project.name })}
                      title={t("edit")}
                    >
                      <PencilIcon className="size-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => setToDelete(project)}
                      className={`${iconButton} hover:text-error-500! dark:hover:text-error-400!`}
                      aria-label={t("deleteLabel", { name: project.name })}
                      title={t("delete.confirm")}
                    >
                      <TrashBinIcon className="size-4" />
                    </button>
                  </div>
                </div>

                {project.description && (
                  <p className="mt-4 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                    {project.description}
                  </p>
                )}

                <dl className="mt-4 space-y-3">
                  <Field
                    label={t("form.audience")}
                    value={project.target_audience}
                  />
                  <Field label={t("form.tone")} value={project.voice_tone} />
                </dl>

                <div className="mt-auto pt-5">
                  {isCurrent ? (
                    <p className="text-center text-theme-xs text-gray-500 dark:text-gray-400">
                      {t("inUse")}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => select(project.id)}
                      className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-brand-500 ring-1 ring-brand-200 ring-inset hover:bg-brand-50 dark:text-brand-400 dark:ring-brand-500/30 dark:hover:bg-brand-500/10"
                    >
                      {t("use")}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <DeleteProjectModal
        project={toDelete}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
