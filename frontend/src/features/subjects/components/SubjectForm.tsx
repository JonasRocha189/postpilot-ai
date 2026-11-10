import { FormInput, FormTextArea } from "@/components/form/FormField";
import {
  alertErrorClass,
  secondaryLinkClass,
} from "@/components/common/styles";
import Button from "@/components/ui/button/Button";
import type { Project } from "@/features/projects/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { subjectFormSchema, LIMITS, type SubjectFormValues } from "../schema";

export default function SubjectForm({
  project,
  defaultValues,
  onSubmit,
  submitLabel,
  submitError,
}: {
  /** The subject's project: shows the inherited voice when the fields are empty */
  project: Project;
  defaultValues: SubjectFormValues;
  onSubmit: (values: SubjectFormValues) => Promise<unknown>;
  submitLabel: string;
  submitError?: string | null;
}) {
  const { t } = useTranslation("app");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SubjectFormValues>({
    resolver: zodResolver(subjectFormSchema),
    defaultValues,
  });

  const error = (field: keyof SubjectFormValues) => {
    const message = errors[field]?.message;
    return message ? t(message, { max: LIMITS[field] }) : undefined;
  };

  const inherited = (value: string | null) =>
    value
      ? t("subjects.form.inherits", { value: value })
      : t("subjects.form.inheritsNothing");

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <FormInput
        id="assunto-nome"
        label={t("subjects.form.name")}
        placeholder={t("subjects.form.namePlaceholder")}
        required
        autoFocus
        maxLength={LIMITS.name}
        error={error("name")}
        {...register("name")}
      />
      <FormTextArea
        id="assunto-descricao"
        label={t("subjects.form.description")}
        placeholder={t("subjects.form.descriptionPlaceholder")}
        error={error("description")}
        {...register("description")}
      />

      <fieldset className="space-y-6 rounded-xl border border-gray-200 p-4 sm:p-5 dark:border-gray-800">
        <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-white/90">
          {t("subjects.form.voiceSection")}
        </legend>
        <p className="-mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t("subjects.form.voiceHint", { project: project.name })}
        </p>
        <FormTextArea
          id="assunto-publico"
          label={t("projects.form.audience")}
          placeholder={
            project.target_audience ?? t("projects.form.audiencePlaceholder")
          }
          rows={2}
          hint={inherited(project.target_audience)}
          error={error("target_audience")}
          {...register("target_audience")}
        />
        <FormTextArea
          id="assunto-tom"
          label={t("projects.form.tone")}
          placeholder={project.voice_tone ?? t("projects.form.tonePlaceholder")}
          rows={2}
          hint={inherited(project.voice_tone)}
          error={error("voice_tone")}
          {...register("voice_tone")}
        />
      </fieldset>

      {submitError && (
        <p role="alert" className={alertErrorClass}>
          {submitError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link to="/subjects" className={secondaryLinkClass}>
          {t("form.cancel")}
        </Link>
        <Button disabled={isSubmitting} className="sm:min-w-36">
          {isSubmitting ? t("form.saving") : submitLabel}
        </Button>
      </div>
    </form>
  );
}
