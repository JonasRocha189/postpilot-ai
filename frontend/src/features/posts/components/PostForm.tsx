import {
  alertErrorClass,
  cardClass,
  secondaryLinkClass,
} from "@/components/common/styles";
import {
  FormInput,
  FormSelect,
  FormTextArea,
} from "@/components/form/FormField";
import Button from "@/components/ui/button/Button";
import type { Assunto } from "@/features/assuntos/types";
import SeletorImagem from "@/features/imagens/components/SeletorImagem";
import { STATUS_POST } from "@/lib/dominio";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { postFormSchema, type PostFormValues } from "../schema";

/**
 * Formulário do post, com a imagem escolhida na biblioteca do projeto.
 * As variações por rede ainda não existem no backend.
 */
export default function PostForm({
  projetoId,
  assuntos,
  defaultValues,
  onSubmit,
  submitLabel,
  submitError,
}: {
  /** Projeto do post: a imagem vem da biblioteca dele */
  projetoId: string;
  assuntos: Assunto[];
  defaultValues: PostFormValues;
  onSubmit: (values: PostFormValues) => Promise<unknown>;
  submitLabel: string;
  submitError?: string | null;
}) {
  const { t } = useTranslation("app");
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues,
  });

  const erro = (message?: string) =>
    message ? t(message, { max: 200 }) : undefined;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {/* Mestre */}
      <section className={`${cardClass} p-5 sm:p-6`}>
        <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">
          {t("posts.form.postSection")}
        </h3>
        <div className="space-y-5">
          <FormInput
            id="post-titulo"
            label={t("posts.form.title")}
            placeholder={t("posts.form.titlePlaceholder")}
            hint={t("posts.form.titleHint")}
            required
            autoFocus
            maxLength={200}
            error={erro(errors.title?.message)}
            {...register("title")}
          />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <FormSelect
              id="post-assunto"
              label={t("posts.form.subject")}
              required
              error={erro(errors.subject_id?.message)}
              {...register("subject_id")}
            >
              <option value="">{t("posts.form.subjectPlaceholder")}</option>
              {assuntos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </FormSelect>
            <FormSelect
              id="post-status"
              label={t("posts.form.status")}
              hint={t("posts.form.statusHint")}
              {...register("status")}
            >
              {STATUS_POST.map((s) => (
                <option key={s} value={s}>
                  {t(`domain.postStatus.${s}`)}
                </option>
              ))}
            </FormSelect>
            <FormInput
              id="post-data"
              type="date"
              label={t("posts.form.scheduledFor")}
              {...register("expected_date")}
            />
          </div>
          <FormTextArea
            id="post-content"
            label={t("posts.form.content")}
            placeholder={t("posts.form.contentPlaceholder")}
            rows={8}
            {...register("content")}
          />
          <Controller
            control={control}
            name="image_id"
            render={({ field }) => (
              <SeletorImagem
                projetoId={projetoId}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      </section>

      {submitError && (
        <p role="alert" className={alertErrorClass}>
          {submitError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link to="/posts" className={secondaryLinkClass}>
          {t("form.cancel")}
        </Link>
        <Button disabled={isSubmitting} className="sm:min-w-36">
          {isSubmitting ? t("form.saving") : submitLabel}
        </Button>
      </div>
    </form>
  );
}
