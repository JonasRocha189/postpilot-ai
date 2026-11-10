import DateField from "@/components/form/DateField";
import { FormSelect } from "@/components/form/FormField";
import CreateArt from "@/features/art/components/CreateArt";
import ImagePicker from "@/features/images/components/ImagePicker";
import {
  NETWORK_LABEL,
  POST_STATUS,
  type PostFormat,
  type Network,
} from "@/lib/domain";
import { useFormat } from "@/lib/format";
import { cn } from "@/utils";
import {
  Controller,
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormGetValues,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  FORMATS_BY_NETWORK,
  CHAR_LIMIT_BY_NETWORK,
  maxImagesFor,
} from "../networks";
import type { PostFormValues } from "../schema";
import TextEditor from "./TextEditor";
import { optionClass } from "./optionClass";

/**
 * One variation of the post (detail): status, date, format, images (with the
 * artwork editor) and the text, following the rules of its network.
 */
export default function VariationEditor({
  index,
  network,
  projectId,
  control,
  register,
  setValue,
  getValues,
  errors,
}: {
  index: number;
  network: Network;
  /** Project of the post: images come from its library */
  projectId: string;
  control: Control<PostFormValues>;
  register: UseFormRegister<PostFormValues>;
  setValue: UseFormSetValue<PostFormValues>;
  getValues: UseFormGetValues<PostFormValues>;
  errors: FieldErrors<PostFormValues>;
}) {
  const { t } = useTranslation("app");
  const fmt = useFormat();
  const path = `variations.${index}` as const;
  const format = useWatch({ control, name: `${path}.format` });
  const maxImages = maxImagesFor(network, format);
  const fieldErrors = errors.variations?.[index];

  const message = (key?: string, values: Record<string, unknown> = {}) =>
    key
      ? t(key, {
          max: maxImages,
          limit: fmt.number(CHAR_LIMIT_BY_NETWORK[network]),
          network: NETWORK_LABEL[network],
          ...values,
        })
      : undefined;

  /** Changing the format trims the images: text has none, single keeps the first. */
  const chooseFormat = (next: PostFormat) => {
    setValue(`${path}.format`, next, { shouldDirty: true });
    const images = getValues(`${path}.image_ids`);
    const limit = maxImagesFor(network, next);
    if (images.length > limit) {
      setValue(`${path}.image_ids`, images.slice(0, limit), {
        shouldDirty: true,
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormSelect
          id={`post-status-${network}`}
          label={t("posts.form.status")}
          hint={t("posts.form.statusHint")}
          {...register(`${path}.status`)}
        >
          {POST_STATUS.map((s) => (
            <option key={s} value={s}>
              {t(`domain.postStatus.${s}`)}
            </option>
          ))}
        </FormSelect>
        <Controller
          control={control}
          name={`${path}.expected_date`}
          render={({ field }) => (
            <DateField
              id={`post-date-${network}`}
              label={t("posts.form.scheduledFor")}
              value={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">
          {t("posts.form.format")}
        </legend>
        <div
          className={cn(
            "grid grid-cols-1 gap-3",
            FORMATS_BY_NETWORK[network].length === 3
              ? "sm:grid-cols-3"
              : "sm:grid-cols-2",
          )}
        >
          {FORMATS_BY_NETWORK[network].map((f) => (
            <label key={f} className={optionClass(f === format)}>
              <input
                type="radio"
                name={`post-format-${network}`}
                value={f}
                checked={f === format}
                onChange={() => chooseFormat(f)}
                className="sr-only"
              />
              <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                {t(`posts.form.formats.${network}.${f}.label`)}
              </span>
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                {t(`posts.form.formats.${network}.${f}.hint`)}
              </span>
            </label>
          ))}
        </div>
        {fieldErrors?.format?.message && (
          <p role="alert" className="mt-1.5 text-xs text-error-500">
            {message(fieldErrors.format.message)}
          </p>
        )}
        <Link
          to={`/best-practices?network=${network}`}
          className="mt-2 inline-block text-theme-xs font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
        >
          {t("posts.form.seeBestPractices", {
            network: NETWORK_LABEL[network],
          })}
        </Link>
      </fieldset>

      {maxImages > 0 && (
        <Controller
          control={control}
          name={`${path}.image_ids`}
          render={({ field }) => (
            <div className="space-y-4">
              <ImagePicker
                projectId={projectId}
                value={field.value}
                onChange={field.onChange}
                max={maxImages}
                error={message(fieldErrors?.image_ids?.message)}
              />
              {/* Single image: replaces it; carousel: adds the slides at the end */}
              <CreateArt
                projectId={projectId}
                network={network}
                initialText={() => getValues("title")}
                maxSlides={
                  format === "single" ? 1 : maxImages - field.value.length
                }
                onCreated={(images) => {
                  const ids = images.map((i) => i.id);
                  field.onChange(
                    format === "single"
                      ? ids.slice(0, 1)
                      : [...field.value, ...ids].slice(0, maxImages),
                  );
                }}
              />
            </div>
          )}
        />
      )}
      {/* The text comes after the image: the artwork is usually made first */}
      <Controller
        control={control}
        name={`${path}.content`}
        render={({ field }) => (
          <TextEditor
            id={`post-content-${network}`}
            label={t("posts.form.content")}
            value={field.value}
            onChange={field.onChange}
            network={network}
            error={message(fieldErrors?.content?.message)}
          />
        )}
      />
    </div>
  );
}
