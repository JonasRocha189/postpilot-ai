import {
  alertErrorClass,
  cardClass,
  secondaryLinkClass,
} from "@/components/common/styles";
import CampoData from "@/components/form/CampoData";
import { FormInput, FormSelect } from "@/components/form/FormField";
import Button from "@/components/ui/button/Button";
import CriarArte from "@/features/arte/components/CriarArte";
import type { Assunto } from "@/features/assuntos/types";
import SeletorImagens from "@/features/imagens/components/SeletorImagens";
import {
  REDE_LABEL,
  STATUS_POST,
  type FormatoPost,
  type Rede,
} from "@/lib/dominio";
import { useFormat } from "@/lib/format";
import { cn } from "@/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { FORMATOS_POR_REDE, LIMITE_CARACTERES, maximoImagens } from "../redes";
import { postFormSchema, type PostFormValues } from "../schema";
import EditorTexto from "./EditorTexto";

/** Ordem das redes no formulário. */
const REDES_FORM: readonly Rede[] = ["instagram", "linkedin", "x"];

const opcaoClass = (selecionada: boolean) =>
  cn(
    "flex cursor-pointer flex-col gap-0.5 rounded-xl border px-4 py-3 text-start transition-colors has-focus-visible:ring-3 has-focus-visible:ring-brand-500/20",
    selecionada
      ? "border-brand-500 bg-brand-50 dark:border-brand-500 dark:bg-brand-500/10"
      : "border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700",
  );

/**
 * Formulário do post: rede e formato (único, carrossel...), texto com editor,
 * data com calendário e imagens da biblioteca do projeto na ordem do carrossel.
 */
export default function PostForm({
  projetoId,
  assuntos,
  defaultValues,
  onSubmit,
  submitLabel,
  submitError,
}: {
  /** Projeto do post: as imagens vêm da biblioteca dele */
  projetoId: string;
  assuntos: Assunto[];
  defaultValues: PostFormValues;
  onSubmit: (values: PostFormValues) => Promise<unknown>;
  submitLabel: string;
  submitError?: string | null;
}) {
  const { t } = useTranslation("app");
  const fmt = useFormat();
  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues,
  });
  const rede = useWatch({ control, name: "network" });
  const formato = useWatch({ control, name: "format" });
  const maximo = maximoImagens(rede, formato);

  const erro = (message?: string, valores: Record<string, unknown> = {}) =>
    message
      ? t(message, {
          max: maximo,
          limit: fmt.number(LIMITE_CARACTERES[rede]),
          network: REDE_LABEL[rede],
          ...valores,
        })
      : undefined;

  /** Ao trocar o formato, ajusta as imagens: só texto não tem, único fica com a primeira. */
  const escolherFormato = (novo: FormatoPost) => {
    setValue("format", novo, { shouldDirty: true });
    const imagens = getValues("image_ids");
    const limite = maximoImagens(getValues("network"), novo);
    if (imagens.length > limite) {
      setValue("image_ids", imagens.slice(0, limite), { shouldDirty: true });
    }
  };

  /** Ao trocar a rede, mantém o formato se ela aceitar; senão usa o primeiro dela. */
  const escolherRede = (nova: Rede) => {
    setValue("network", nova, { shouldDirty: true });
    const atual = getValues("format");
    escolherFormato(
      FORMATOS_POR_REDE[nova].includes(atual)
        ? atual
        : FORMATOS_POR_REDE[nova][0],
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
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
            error={erro(errors.title?.message, { max: 200 })}
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
            <Controller
              control={control}
              name="expected_date"
              render={({ field }) => (
                <CampoData
                  id="post-data"
                  label={t("posts.form.scheduledFor")}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
        </div>
      </section>

      <section className={`${cardClass} p-5 sm:p-6`}>
        <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90">
          {t("posts.form.publishSection")}
        </h3>
        <div className="space-y-5">
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">
              {t("posts.form.network")}
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {REDES_FORM.map((r) => (
                <label key={r} className={opcaoClass(r === rede)}>
                  <input
                    type="radio"
                    name="post-network"
                    value={r}
                    checked={r === rede}
                    onChange={() => escolherRede(r)}
                    className="sr-only"
                  />
                  <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                    {REDE_LABEL[r]}
                  </span>
                  <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {t("posts.form.networkHint", {
                      limit: fmt.number(LIMITE_CARACTERES[r]),
                    })}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">
              {t("posts.form.format")}
            </legend>
            <div
              className={cn(
                "grid grid-cols-1 gap-3",
                FORMATOS_POR_REDE[rede].length === 3
                  ? "sm:grid-cols-3"
                  : "sm:grid-cols-2",
              )}
            >
              {FORMATOS_POR_REDE[rede].map((f) => (
                <label key={f} className={opcaoClass(f === formato)}>
                  <input
                    type="radio"
                    name="post-format"
                    value={f}
                    checked={f === formato}
                    onChange={() => escolherFormato(f)}
                    className="sr-only"
                  />
                  <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                    {t(`posts.form.formats.${rede}.${f}.label`)}
                  </span>
                  <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {t(`posts.form.formats.${rede}.${f}.hint`)}
                  </span>
                </label>
              ))}
            </div>
            {errors.format?.message && (
              <p role="alert" className="mt-1.5 text-xs text-error-500">
                {erro(errors.format.message)}
              </p>
            )}
            <Link
              to={`/best-practices?network=${rede}`}
              className="mt-2 inline-block text-theme-xs font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
            >
              {t("posts.form.seeBestPractices", { network: REDE_LABEL[rede] })}
            </Link>
          </fieldset>

          {maximo > 0 && (
            <Controller
              control={control}
              name="image_ids"
              render={({ field }) => (
                <div className="space-y-4">
                  <SeletorImagens
                    projetoId={projetoId}
                    value={field.value}
                    onChange={field.onChange}
                    max={maximo}
                    error={erro(errors.image_ids?.message)}
                  />
                  {/* Imagem única: troca a imagem; carrossel: soma slides ao fim */}
                  <CriarArte
                    projetoId={projetoId}
                    rede={rede}
                    textoInicial={() => getValues("title")}
                    maxSlides={
                      formato === "single" ? 1 : maximo - field.value.length
                    }
                    onCriadas={(imagens) => {
                      const ids = imagens.map((i) => i.id);
                      field.onChange(
                        formato === "single"
                          ? ids.slice(0, 1)
                          : [...field.value, ...ids].slice(0, maximo),
                      );
                    }}
                  />
                </div>
              )}
            />
          )}
          {/* O texto vem depois da imagem: a arte costuma ser feita primeiro */}
          <Controller
            control={control}
            name="content"
            render={({ field }) => (
              <EditorTexto
                id="post-content"
                label={t("posts.form.content")}
                value={field.value}
                onChange={field.onChange}
                network={rede}
                error={erro(errors.content?.message)}
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
