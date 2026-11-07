import {
  alertErrorClass,
  cardClass,
  secondaryLinkClass,
} from "@/components/common/styles";
import { FormInput, FormSelect } from "@/components/form/FormField";
import Badge from "@/components/ui/badge/Badge";
import Button from "@/components/ui/button/Button";
import type { Assunto } from "@/features/assuntos/types";
import { REDE_LABEL, STATUS_POST_COR, type Rede } from "@/lib/dominio";
import { useFormat } from "@/lib/format";
import { cn } from "@/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState, type KeyboardEvent } from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type FieldErrors,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { LIMITE_CARACTERES } from "../redes";
import {
  NETWORK_ORDER,
  newVariation,
  postFormSchema,
  type PostFormValues,
  type VariationFormValues,
} from "../schema";
import { optionClass } from "./optionClass";
import VariationEditor from "./VariationEditor";

/**
 * Post form, master-detail on the same screen: the post (title and subject)
 * and its variations, one per network, each in a tab with its own status,
 * date, format, images and text.
 */
export default function PostForm({
  projetoId,
  assuntos,
  defaultValues,
  initialNetwork,
  onSubmit,
  submitLabel,
  submitError,
}: {
  /** Project of the post: images come from its library */
  projetoId: string;
  assuntos: Assunto[];
  defaultValues: PostFormValues;
  /** Tab opened first (e.g. coming from the calendar) */
  initialNetwork?: Rede | null;
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
  const { fields, append, remove } = useFieldArray({
    control,
    name: "variations",
  });
  const variations = useWatch({ control, name: "variations" });
  const networks = fields.map((f) => f.network);

  const [active, setActive] = useState<Rede>(() =>
    initialNetwork && networks.includes(initialNetwork)
      ? initialNetwork
      : (networks[0] ?? "instagram"),
  );
  const activeIndex = Math.max(0, networks.indexOf(active));
  const tabRefs = useRef(new Map<Rede, HTMLButtonElement>());
  /** Unchecked networks keep their text here, in case they come back */
  const removed = useRef(new Map<Rede, VariationFormValues>());

  const toggleNetwork = (network: Rede) => {
    const index = networks.indexOf(network);
    if (index === -1) {
      // Appended at the end; tabs and the API body use the fixed network order
      append(removed.current.get(network) ?? newVariation(network));
      setActive(network);
      return;
    }
    if (networks.length === 1) return; // a post needs at least one network
    removed.current.set(network, getValues(`variations.${index}`));
    remove(index);
    if (active === network) {
      setActive(networks.find((n) => n !== network) ?? networks[0]);
    }
  };

  const hasErrors = (index: number) => Boolean(errors.variations?.[index]);

  /** Invalid submit: open the first tab with an error. */
  const onInvalid = (invalid: FieldErrors<PostFormValues>) => {
    const index = networks.findIndex((_, i) => invalid.variations?.[i]);
    if (index >= 0) setActive(networks[index]);
  };

  // Arrow keys move between the tabs (WAI-ARIA tabs pattern)
  const ordered = NETWORK_ORDER.filter((n) => networks.includes(n));
  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next =
      ordered[
        (ordered.indexOf(active) + step + ordered.length) % ordered.length
      ];
    setActive(next);
    tabRefs.current.get(next)?.focus();
  };

  const titleError = errors.title?.message;
  const subjectError = errors.subject_id?.message;
  const variationsError =
    errors.variations?.root?.message ?? errors.variations?.message;

  return (
    <form
      onSubmit={handleSubmit(onSubmit, onInvalid)}
      noValidate
      className="space-y-6"
    >
      {/* Master: the post */}
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
            error={titleError ? t(titleError, { max: 200 }) : undefined}
            {...register("title")}
          />
          <FormSelect
            id="post-assunto"
            label={t("posts.form.subject")}
            required
            error={subjectError ? t(subjectError) : undefined}
            {...register("subject_id")}
          >
            <option value="">{t("posts.form.subjectPlaceholder")}</option>
            {assuntos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </FormSelect>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">
              {t("posts.form.networks")}
            </legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {NETWORK_ORDER.map((n) => {
                const checked = networks.includes(n);
                return (
                  <label key={n} className={optionClass(checked)}>
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        // The last network can't be removed
                        disabled={checked && networks.length === 1}
                        onChange={() => toggleNetwork(n)}
                        className="size-4 accent-brand-500"
                      />
                      <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                        {REDE_LABEL[n]}
                      </span>
                    </span>
                    <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                      {t("posts.form.networkHint", {
                        limit: fmt.number(LIMITE_CARACTERES[n]),
                      })}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-1.5 text-theme-xs text-gray-500 dark:text-gray-400">
              {t("posts.form.networksHint")}
            </p>
            {variationsError && (
              <p role="alert" className="mt-1.5 text-xs text-error-500">
                {t(variationsError)}
              </p>
            )}
          </fieldset>
        </div>
      </section>

      {/* Detail: one variation per network */}
      <section className={`${cardClass} p-5 sm:p-6`}>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          {t("posts.form.variationsSection")}
        </h3>
        <p className="mt-1 mb-5 text-sm text-gray-500 dark:text-gray-400">
          {t("posts.form.variationsHint")}
        </p>

        <div
          role="tablist"
          aria-label={t("posts.form.variationsSection")}
          className="mb-5 flex gap-2 overflow-x-auto border-b border-gray-200 dark:border-gray-800"
        >
          {ordered.map((n) => {
            const index = networks.indexOf(n);
            const selected = n === active;
            const status = variations[index]?.status ?? "draft";
            return (
              <button
                key={n}
                ref={(el) => {
                  if (el) tabRefs.current.set(n, el);
                  else tabRefs.current.delete(n);
                }}
                type="button"
                role="tab"
                id={`variation-tab-${n}`}
                aria-selected={selected}
                aria-controls={`variation-panel-${n}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(n)}
                onKeyDown={onTabKeyDown}
                className={cn(
                  "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap",
                  selected
                    ? "border-brand-500 text-brand-500 dark:text-brand-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200",
                )}
              >
                {REDE_LABEL[n]}
                <Badge color={STATUS_POST_COR[status]} size="sm">
                  {t(`domain.postStatus.${status}`)}
                </Badge>
                {hasErrors(index) && (
                  <span
                    className="size-2 rounded-full bg-error-500"
                    title={t("posts.form.tabHasErrors")}
                  >
                    <span className="sr-only">
                      {t("posts.form.tabHasErrors")}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Only the open tab is rendered; the others keep their values in the form */}
        <div
          role="tabpanel"
          id={`variation-panel-${active}`}
          aria-labelledby={`variation-tab-${active}`}
        >
          <VariationEditor
            key={fields[activeIndex]?.id ?? active}
            index={activeIndex}
            network={networks[activeIndex] ?? active}
            projectId={projetoId}
            control={control}
            register={register}
            setValue={setValue}
            getValues={getValues}
            errors={errors}
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
