import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import {
  useUpdateProject,
  useCreateProject,
  useProject,
} from "@/features/projects/api";
import ProjectForm from "@/features/projects/components/ProjectForm";
import {
  toFormValues,
  toProjectInput,
  type ProjectFormValues,
} from "@/features/projects/schema";
import { useCurrentProject } from "@/features/projects/useCurrentProject";
import { ApiError } from "@/lib/api/http";
import NotFound from "@/pages/OtherPage/NotFound";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";

/** /projects/new (no id) and /projects/:id (editing) */
export default function ProjectFormPage() {
  const { id } = useParams();
  const { t } = useTranslation("app", { keyPrefix: "projects" });
  const navigate = useNavigate();
  const { select } = useCurrentProject();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const project = useProject(id);
  const create = useCreateProject();
  const update = useUpdateProject();

  const isEdit = Boolean(id);
  const title = isEdit ? t("editTitle") : t("newTitle");

  const onSubmit = async (values: ProjectFormValues) => {
    setSubmitError(null);
    try {
      if (id) {
        await update.mutateAsync({ id, input: toProjectInput(values) });
      } else {
        const newItem = await create.mutateAsync(toProjectInput(values));
        // Whoever creates a project wants to work in it
        select(newItem.id);
      }
      navigate("/projects");
    } catch {
      setSubmitError(t("form.saveError"));
    }
  };

  if (
    isEdit &&
    project.error instanceof ApiError &&
    project.error.status === 404
  ) {
    return <NotFound />;
  }

  return (
    <>
      <PageMeta title={`${title} | PostPilot`} description={t("subtitle")} />
      <PageBreadcrumb pageTitle={title} />

      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 sm:p-8 dark:border-gray-800 dark:bg-white/3">
        {isEdit && project.isLoading ? (
          <div className="space-y-4" aria-hidden>
            <div className="h-11 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            <div className="h-40 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          </div>
        ) : isEdit && project.isError ? (
          <p role="alert" className="text-sm text-error-600">
            {t("loadError")}
          </p>
        ) : (
          <ProjectForm
            // Remounts when the data arrives, to fill the form
            key={project.data?.id ?? "novo"}
            defaultValues={toFormValues(project.data)}
            onSubmit={onSubmit}
            submitLabel={isEdit ? t("form.save") : t("form.create")}
            submitError={submitError}
          />
        )}
      </div>
    </>
  );
}
