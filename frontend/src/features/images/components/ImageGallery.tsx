import ConfirmDeleteModal from "@/components/common/ConfirmDeleteModal";
import Badge from "@/components/ui/badge/Badge";
import { Modal } from "@/components/ui/modal";
import { usePosts } from "@/features/posts/api";
import { CloseIcon, TrashBinIcon, UploadIcon } from "@/icons";
import { useFormat } from "@/lib/format";
import { cn } from "@/utils";
import { useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useUploadImage, useDeleteImage, useImages } from "../api";
import { ACCEPT, MAX_SIZE } from "../file";
import type { Image } from "../types";

type Upload = {
  key: string;
  name: string;
  progress: number;
  error: string | null;
};

/**
 * The project's image library: direct upload to S3, thumbnails, enlarged
 * view (with the posts that use the image) and deletion.
 */
export default function ImageGallery({ projectId }: { projectId: string }) {
  const { t } = useTranslation("app", { keyPrefix: "images" });
  const fmt = useFormat();
  const images = useImages(projectId);
  const posts = usePosts(projectId);
  const send = useUploadImage();
  const deleteImage = useDeleteImage();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [enlarged, setEnlarged] = useState<Image | null>(null);
  const [toDelete, setToDelete] = useState<Image | null>(null);

  const postsUsing = (imageId: string) =>
    posts.data?.filter((p) =>
      p.variations.some((v) => v.image_ids.includes(imageId)),
    ) ?? [];
  const maxMb = fmt.number(MAX_SIZE / 1024 / 1024);

  const update = (key: string, change: Partial<Upload>) =>
    setUploads((current) =>
      current.map((e) => (e.key === key ? { ...e, ...change } : e)),
    );
  const remove = (key: string) =>
    setUploads((current) => current.filter((e) => e.key !== key));

  const reason = (code: string | undefined) => {
    if (code === "file-too-large") return t("tooLarge", { max: maxMb });
    if (code === "file-invalid-type") return t("invalidType");
    return t("failed");
  };

  const onDrop = (accepted: File[], rejected: FileRejection[]) => {
    const newItems: Upload[] = accepted.map((f) => ({
      key: crypto.randomUUID(),
      name: f.name,
      progress: 0,
      error: null,
    }));
    const refused: Upload[] = rejected.map((r) => ({
      key: crypto.randomUUID(),
      name: r.file.name,
      progress: 0,
      error: reason(r.errors[0]?.code),
    }));
    setUploads((current) => [...current, ...newItems, ...refused]);

    accepted.forEach((file, i) => {
      const { key } = newItems[i];
      send.mutate(
        {
          projectId,
          file,
          onProgress: (p) => update(key, { progress: p }),
        },
        {
          onSuccess: () => remove(key),
          onError: () => update(key, { error: t("failed") }),
        },
      );
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: MAX_SIZE,
    multiple: true,
  });

  if (images.isError) {
    return (
      <p role="alert" className="text-sm text-error-600 dark:text-error-400">
        {t("loadError")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <li>
          <div
            {...getRootProps({
              className: cn(
                "flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-3 text-center transition-colors",
                isDragActive
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                  : "border-gray-300 hover:border-brand-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-brand-800 dark:hover:bg-white/3",
              ),
            })}
          >
            <input {...getInputProps({ "aria-label": t("inputLabel") })} />
            <UploadIcon className="mb-2 size-6 text-gray-500 dark:text-gray-400" />
            <span className="text-theme-xs font-medium text-gray-700 dark:text-gray-300">
              {isDragActive ? t("drop") : t("add")}
            </span>
            <span className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
              {t("hint", { max: maxMb })}
            </span>
          </div>
        </li>

        {images.isLoading &&
          [0, 1, 2].map((i) => (
            <li
              key={i}
              aria-hidden
              className="aspect-square animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
            />
          ))}

        {images.data?.map((image, i) => {
          const uses = postsUsing(image.id).length;
          return (
            <li key={image.id} className="relative">
              <button
                type="button"
                onClick={() => setEnlarged(image)}
                aria-label={t("open", { n: i + 1 })}
                className="block aspect-square w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
              >
                <img
                  src={image.url}
                  alt={image.description ?? ""}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
              {uses > 0 && (
                <span className="pointer-events-none absolute start-2 top-2">
                  <Badge color="info" size="sm">
                    {t("usedIn", { count: uses })}
                  </Badge>
                </span>
              )}
              <button
                type="button"
                onClick={() => setToDelete(image)}
                aria-label={t("deleteLabel", { n: i + 1 })}
                className="absolute end-2 top-2 flex size-8 items-center justify-center rounded-lg bg-white/90 text-gray-600 shadow-theme-xs hover:text-error-500 dark:bg-gray-900/90 dark:text-gray-300"
              >
                <TrashBinIcon className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>

      {!images.isLoading &&
        images.data?.length === 0 &&
        uploads.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t("empty")}
          </p>
        )}

      {uploads.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {uploads.map((upload) => (
            <li
              key={upload.key}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-2.5",
                upload.error
                  ? "border-error-200 bg-error-50 dark:border-error-500/30 dark:bg-error-500/10"
                  : "border-gray-200 dark:border-gray-800",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-gray-800 dark:text-white/90">
                  {upload.name}
                </p>
                {upload.error ? (
                  <p className="text-theme-xs text-error-600 dark:text-error-400">
                    {upload.error}
                  </p>
                ) : (
                  <div
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                    role="progressbar"
                    aria-label={t("progress", { name: upload.name })}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(upload.progress * 100)}
                  >
                    <div
                      className="h-full rounded-full bg-brand-500 transition-[width]"
                      style={{ width: `${Math.round(upload.progress * 100)}%` }}
                    />
                  </div>
                )}
              </div>
              {upload.error && (
                <button
                  type="button"
                  onClick={() => remove(upload.key)}
                  aria-label={t("dismiss")}
                  className="flex size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-white dark:text-gray-400 dark:hover:bg-white/5"
                >
                  <CloseIcon className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal
        isOpen={Boolean(enlarged)}
        onClose={() => setEnlarged(null)}
        className="m-4 max-w-[720px] p-4 sm:p-6"
      >
        {enlarged && (
          <figure>
            <img
              src={enlarged.url}
              alt={enlarged.description ?? ""}
              className="mx-auto max-h-[65vh] rounded-xl object-contain"
            />
            <figcaption className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
              {enlarged.description && (
                <p className="font-medium text-gray-800 dark:text-white/90">
                  {enlarged.description}
                </p>
              )}
              <p className="text-theme-xs">
                {t("uploadedOn", {
                  date: fmt.date(enlarged.created_at, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  }),
                })}
              </p>
              {postsUsing(enlarged.id).length > 0 ? (
                <div>
                  <p className="text-theme-xs font-medium">{t("usedBy")}</p>
                  <ul className="mt-1 space-y-0.5">
                    {postsUsing(enlarged.id).map((p) => (
                      <li key={p.id}>
                        <Link
                          to={`/posts/${p.id}`}
                          className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                        >
                          {p.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-theme-xs">{t("notUsed")}</p>
              )}
            </figcaption>
          </figure>
        )}
      </Modal>

      <ConfirmDeleteModal
        isOpen={Boolean(toDelete)}
        title={t("deleteTitle")}
        message={t("deleteMessage")}
        conflictMessage={t("deleteConflict")}
        onConfirm={() => deleteImage.mutateAsync(toDelete!.id)}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
