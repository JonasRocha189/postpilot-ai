import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import { cardClass } from "@/components/common/styles";
import {
  useSubject,
  useUpdateSubject,
  useCreateSubject,
} from "@/features/subjects/api";
import SubjectForm from "@/features/subjects/components/SubjectForm";
import {
  toSubjectInput,
  toFormValues,
  type SubjectFormValues,
} from "@/features/subjects/schema";
import { useCurrentProject } from "@/features/projects/useCurrentProject";
import { ApiError } from "@/lib/api/http";
import NotFound from "@/pages/OtherPage/NotFound";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";

/** /subjects/new (no id) and /subjects/:id (editing) */
export default function SubjectFormPage() {
  const { id } = useParams();
  const { t } = useTranslation("app", { keyPrefix: "subjects" });
  const navigate = useNavigate();
  const { projects, currentProject } = useCurrentProject();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const subject = useSubject(id);
  const create = useCreateSubject();
  const update = useUpdateSubject();

  const isEdit = Boolean(id);
  const title = isEdit ? t("editTitle") : t("newTitle");
  // When editing, the inherited voice is that of the subject's project
  const project =
    (subject.data && projects.find((p) => p.id === subject.data.project_id)) ||
    currentProject;

  const onSubmit = async (values: SubjectFormValues) => {
    setSubmitError(null);
    try {
      if (id) {
        await update.mutateAsync({ id, input: toSubjectInput(values) });
      } else {
        await create.mutateAsync({
          projectId: currentProject!.id,
          input: toSubjectInput(values),
        });
      }
      navigate("/subjects");
    } catch {
      setSubmitError(t("saveError"));
    }
  };

  if (
    isEdit &&
    subject.error instanceof ApiError &&
    subject.error.status === 404
  ) {
    return <NotFound />;
  }

  return (
    <>
      <PageMeta title={`${title} | PostPilot`} description={t("subtitle")} />
      <PageBreadcrumb pageTitle={title} />

      <div className={`${cardClass} mx-auto max-w-3xl p-5 sm:p-8`}>
        {(isEdit && subject.isLoading) || !project ? (
          <div className="space-y-4" aria-hidden>
            <div className="h-11 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            <div className="h-40 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          </div>
        ) : isEdit && subject.isError ? (
          <p role="alert" className="text-sm text-error-600">
            {t("loadError")}
          </p>
        ) : (
          <SubjectForm
            key={subject.data?.id ?? "novo"}
            project={project}
            defaultValues={toFormValues(subject.data)}
            onSubmit={onSubmit}
            submitLabel={isEdit ? t("save") : t("create")}
            submitError={submitError}
          />
        )}
      </div>
    </>
  );
}
