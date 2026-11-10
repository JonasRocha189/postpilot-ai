import Portal from "@/components/common/Portal";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { ChevronLeftIcon, CloseIcon, ImageIcon, PlusIcon } from "@/icons";
import { cn } from "@/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useImages } from "../api";
import type { Image } from "../types";

const thumbnailButton =
  "flex size-7 items-center justify-center rounded-md bg-white/90 text-gray-600 shadow-theme-xs hover:text-gray-900 disabled:opacity-40 dark:bg-gray-900/90 dark:text-gray-300";

/**
 * The post's images, picked from the project library, in carousel order.
 * `max` = 1 replaces the image on each pick; above 1, several can be checked.
 */
export default function ImagePicker({
  projectId,
  value,
  onChange,
  max,
  error,
}: {
  projectId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  max: number;
  error?: string;
}) {
  const { t } = useTranslation("app", { keyPrefix: "posts.form.image" });
  const images = useImages(projectId);
  const [open, setOpen] = useState(false);
  const byId = new Map(images.data?.map((i) => [i.id, i]));
  const chosen = value
    .map((id) => byId.get(id))
    .filter((i): i is Image => Boolean(i));
  const several = max > 1;

  const mover = (index: number, delta: number) => {
    const newItem = [...value];
    const [item] = newItem.splice(index, 1);
    newItem.splice(index + delta, 0, item);
    onChange(newItem);
  };

  const toggle = (id: string) => {
    if (!several) {
      onChange([id]);
      setOpen(false);
      return;
    }
    if (value.includes(id)) onChange(value.filter((v) => v !== id));
    else if (value.length < max) onChange([...value, id]);
  };

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-400">
          {several ? t("labelMany") : t("label")}
        </p>
        {several && (
          <p className="text-theme-xs text-gray-500 tabular-nums dark:text-gray-400">
            {t("count", { count: value.length, max })}
          </p>
        )}
      </div>

      {value.length > 0 && images.isLoading ? (
        <p className="text-sm text-gray-500">{t("loading")}</p>
      ) : (
        <ol className="flex flex-wrap gap-3">
          {chosen.map((image, i) => (
            <li key={image.id} className="relative">
              <div className="size-24 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                <img
                  src={image.url}
                  alt={image.description ?? t("option", { n: i + 1 })}
                  className="size-full object-cover"
                />
              </div>
              {several && (
                <span className="absolute start-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-gray-900/75 text-theme-xs font-semibold text-white">
                  {i + 1}
                </span>
              )}
              <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between">
                {several ? (
                  <span className="flex gap-1">
                    <button
                      type="button"
                      className={thumbnailButton}
                      disabled={i === 0}
                      onClick={() => mover(i, -1)}
                      aria-label={t("moveLeft", { n: i + 1 })}
                    >
                      <ChevronLeftIcon className="size-4" />
                    </button>
                    <button
                      type="button"
                      className={thumbnailButton}
                      disabled={i === chosen.length - 1}
                      onClick={() => mover(i, 1)}
                      aria-label={t("moveRight", { n: i + 1 })}
                    >
                      <ChevronLeftIcon className="size-4 rotate-180" />
                    </button>
                  </span>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  className={thumbnailButton}
                  onClick={() =>
                    onChange(value.filter((id) => id !== image.id))
                  }
                  aria-label={t("removeOne", { n: i + 1 })}
                >
                  <CloseIcon className="size-4" />
                </button>
              </div>
            </li>
          ))}

          {value.length < max && (
            <li>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex size-24 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 text-theme-xs font-medium text-brand-500 hover:border-brand-300 hover:bg-gray-50 dark:border-gray-700 dark:text-brand-400 dark:hover:bg-white/3"
              >
                {value.length === 0 ? (
                  <ImageIcon className="size-6" aria-hidden />
                ) : (
                  <PlusIcon className="size-5" aria-hidden />
                )}
                {value.length === 0 ? t("choose") : t("add")}
              </button>
            </li>
          )}
          {!several && value.length === 1 && (
            <li className="self-end">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-brand-500 ring-1 ring-brand-200 ring-inset hover:bg-brand-50 dark:text-brand-400 dark:ring-brand-500/30 dark:hover:bg-brand-500/10"
              >
                {t("change")}
              </button>
            </li>
          )}
        </ol>
      )}

      {error && (
        <p role="alert" className="mt-1.5 text-xs text-error-500">
          {error}
        </p>
      )}

      {/* Outside the post's <form> */}
      <Portal>
        <Modal
          isOpen={open}
          onClose={() => setOpen(false)}
          className="m-4 max-w-[760px] p-5 sm:p-6"
        >
          <h3 className="pe-8 text-lg font-semibold text-gray-800 dark:text-white/90">
            {several ? t("dialogTitleMany", { max }) : t("dialogTitle")}
          </h3>

          {images.isError ? (
            <p role="alert" className="mt-4 text-sm text-error-600">
              {t("loadError")}
            </p>
          ) : images.isLoading ? (
            <div
              aria-hidden
              className="mt-4 h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
            />
          ) : !images.data?.length ? (
            <div className="mt-4 rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("emptyLibrary")}
              </p>
              <Link
                to="/images"
                className="mt-3 inline-block text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                {t("goToLibrary")}
              </Link>
            </div>
          ) : (
            <>
              <ul className="mt-4 grid max-h-[55vh] grid-cols-3 gap-3 overflow-y-auto p-1 sm:grid-cols-4">
                {images.data.map((image, i) => {
                  const position = value.indexOf(image.id);
                  const checked = position >= 0;
                  const full = several && !checked && value.length >= max;
                  return (
                    <li key={image.id} className="relative">
                      <button
                        type="button"
                        onClick={() => toggle(image.id)}
                        aria-pressed={checked}
                        disabled={full}
                        aria-label={
                          image.description ?? t("option", { n: i + 1 })
                        }
                        className={cn(
                          "block aspect-square w-full overflow-hidden rounded-xl border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                          checked
                            ? "border-brand-500 ring-2 ring-brand-500/30"
                            : "border-transparent hover:border-brand-300",
                        )}
                      >
                        <img
                          src={image.url}
                          alt=""
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      </button>
                      {several && checked && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute end-2 top-2 flex size-6 items-center justify-center rounded-full bg-brand-500 text-theme-xs font-semibold text-white"
                        >
                          {position + 1}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <Link
                  to="/images"
                  className="text-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  {t("uploadMore")}
                </Link>
                {several && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setOpen(false)}
                  >
                    {t("done", { count: value.length })}
                  </Button>
                )}
              </div>
            </>
          )}
        </Modal>
      </Portal>
    </div>
  );
}
