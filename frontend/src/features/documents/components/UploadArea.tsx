import { CloseIcon, UploadIcon } from "@/icons";
import { useFormat } from "@/lib/format";
import { cn } from "@/utils";
import { useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { useUploadDocument } from "../api";
import { ACCEPT, MAX_SIZE } from "../validation";

type Upload = {
  key: string;
  name: string;
  progress: number;
  error: string | null;
};

/** Drag-and-drop area: uploads each file straight to S3 (with a presigned URL). */
export default function UploadArea({ projectId }: { projectId: string }) {
  const { t } = useTranslation("app", { keyPrefix: "documents.upload" });
  const fmt = useFormat();
  const send = useUploadDocument();
  const [uploads, setUploads] = useState<Upload[]>([]);

  const update = (key: string, change: Partial<Upload>) =>
    setUploads((current) =>
      current.map((e) => (e.key === key ? { ...e, ...change } : e)),
    );
  const remove = (key: string) =>
    setUploads((current) => current.filter((e) => e.key !== key));

  const reason = (rejection: FileRejection) => {
    const code = rejection.errors[0]?.code;
    if (code === "file-too-large")
      return t("tooLarge", { max: fmt.number(MAX_SIZE / 1024 / 1024) });
    if (code === "file-invalid-type") return t("invalidType");
    return t("failed");
  };

  const onDrop = (accepted: File[], rejected: FileRejection[]) => {
    const newItems: Upload[] = [
      ...accepted.map((f) => ({
        key: crypto.randomUUID(),
        name: f.name,
        progress: 0,
        error: null,
      })),
      ...rejected.map((r) => ({
        key: crypto.randomUUID(),
        name: r.file.name,
        progress: 0,
        error: reason(r),
      })),
    ];
    setUploads((current) => [...newItems, ...current]);

    accepted.forEach((file, i) => {
      const { key } = newItems[i];
      send.mutate(
        { projectId, file, onProgress: (p) => update(key, { progress: p }) },
        {
          // Uploaded: leaves this area and shows in the list, already "processing"
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

  return (
    <div className="space-y-3">
      <div
        {...getRootProps({
          className: cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
            isDragActive
              ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
              : "border-gray-300 bg-white hover:border-brand-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-white/3 dark:hover:border-brand-800",
          ),
        })}
      >
        <input {...getInputProps({ "aria-label": t("inputLabel") })} />
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <UploadIcon className="size-6" />
        </span>
        <p className="text-sm font-medium text-gray-800 dark:text-white/90">
          {isDragActive ? t("drop") : t("title")}
        </p>
        <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
          {t("hint", { max: fmt.number(MAX_SIZE / 1024 / 1024) })}
        </p>
      </div>

      {uploads.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {uploads.map((upload) => (
            <li
              key={upload.key}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3",
                upload.error
                  ? "border-error-200 bg-error-50 dark:border-error-500/30 dark:bg-error-500/10"
                  : "border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">
                  {upload.name}
                </p>
                {upload.error ? (
                  <p className="text-theme-xs text-error-600 dark:text-error-400">
                    {upload.error}
                  </p>
                ) : (
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
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
    </div>
  );
}
