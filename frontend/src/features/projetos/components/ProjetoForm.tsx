import { FormInput, FormTextArea } from "@/components/form/FormField";
import Button from "@/components/ui/button/Button";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  LIMITES,
  projetoFormSchema,
  type ProjetoFormValues,
} from "../schema";

export default function ProjetoForm({
  defaultValues,
  onSubmit,
  submitLabel,
  submitError,
}: {
  defaultValues: ProjetoFormValues;
  onSubmit: (values: ProjetoFormValues) => Promise<unknown>;
  submitLabel: string;
  submitError?: string | null;
}) {
  const { t } = useTranslation("app");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProjetoFormValues>({
    resolver: zodResolver(projetoFormSchema),
    defaultValues,
  });

  // As mensagens do schema são chaves de tradução
  const erro = (campo: keyof ProjetoFormValues) => {
    const message = errors[campo]?.message;
    return message ? t(message, { max: LIMITES[campo] }) : undefined;
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <FormInput
        id="projeto-nome"
        label={t("projects.form.name")}
        placeholder={t("projects.form.namePlaceholder")}
        required
        autoFocus
        maxLength={LIMITES.name}
        error={erro("name")}
        {...register("name")}
      />
      <FormTextArea
        id="projeto-descricao"
        label={t("projects.form.description")}
        placeholder={t("projects.form.descriptionPlaceholder")}
        error={erro("description")}
        {...register("description")}
      />

      <fieldset className="space-y-6 rounded-xl border border-gray-200 p-4 sm:p-5 dark:border-gray-800">
        <legend className="px-1 text-sm font-semibold text-gray-800 dark:text-white/90">
          {t("projects.form.voiceSection")}
        </legend>
        <p className="-mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t("projects.form.voiceHint")}
        </p>
        <FormTextArea
          id="projeto-publico"
          label={t("projects.form.audience")}
          placeholder={t("projects.form.audiencePlaceholder")}
          rows={2}
          error={erro("target_audience")}
          {...register("target_audience")}
        />
        <FormTextArea
          id="projeto-tom"
          label={t("projects.form.tone")}
          placeholder={t("projects.form.tonePlaceholder")}
          rows={2}
          error={erro("voice_tone")}
          {...register("voice_tone")}
        />
      </fieldset>

      {submitError && (
        <p
          role="alert"
          className="rounded-lg border border-error-500 bg-error-50 p-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-400"
        >
          {submitError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          to="/projects"
          className="inline-flex items-center justify-center rounded-lg px-5 py-3.5 text-sm font-medium text-gray-700 ring-1 ring-gray-300 ring-inset hover:bg-gray-50 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/3"
        >
          {t("projects.form.cancel")}
        </Link>
        <Button disabled={isSubmitting} className="sm:min-w-36">
          {isSubmitting ? t("projects.form.saving") : submitLabel}
        </Button>
      </div>
    </form>
  );
}
