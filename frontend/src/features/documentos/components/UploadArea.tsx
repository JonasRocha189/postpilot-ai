import { CloseIcon, UploadIcon } from "@/icons";
import { useFormat } from "@/lib/format";
import { cn } from "@/utils";
import { useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { useEnviarDocumento } from "../api";
import { ACCEPT, TAMANHO_MAXIMO } from "../validacao";

type Envio = {
  chave: string;
  name: string;
  progresso: number;
  error: string | null;
};

/** Área de arrastar-e-soltar: envia cada arquivo direto para o S3 (via URL pré-assinada). */
export default function UploadArea({ projetoId }: { projetoId: string }) {
  const { t } = useTranslation("app", { keyPrefix: "documents.upload" });
  const fmt = useFormat();
  const enviar = useEnviarDocumento();
  const [envios, setEnvios] = useState<Envio[]>([]);

  const atualizar = (chave: string, mudanca: Partial<Envio>) =>
    setEnvios((atual) => atual.map((e) => (e.chave === chave ? { ...e, ...mudanca } : e)));
  const remover = (chave: string) =>
    setEnvios((atual) => atual.filter((e) => e.chave !== chave));

  const motivo = (rejeicao: FileRejection) => {
    const codigo = rejeicao.errors[0]?.code;
    if (codigo === "file-too-large") return t("tooLarge", { max: fmt.number(TAMANHO_MAXIMO / 1024 / 1024) });
    if (codigo === "file-invalid-type") return t("invalidType");
    return t("failed");
  };

  const onDrop = (aceitos: File[], rejeitados: FileRejection[]) => {
    const novos: Envio[] = [
      ...aceitos.map((f) => ({ chave: crypto.randomUUID(), name: f.name, progresso: 0, error: null })),
      ...rejeitados.map((r) => ({
        chave: crypto.randomUUID(),
        name: r.file.name,
        progresso: 0,
        error: motivo(r),
      })),
    ];
    setEnvios((atual) => [...novos, ...atual]);

    aceitos.forEach((arquivo, i) => {
      const { chave } = novos[i];
      enviar.mutate(
        { projetoId, arquivo, onProgress: (p) => atualizar(chave, { progresso: p }) },
        {
          // Enviado: some daqui e aparece na lista, já "processing"
          onSuccess: () => remover(chave),
          onError: () => atualizar(chave, { error: t("failed") }),
        },
      );
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: TAMANHO_MAXIMO,
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
          {t("hint", { max: fmt.number(TAMANHO_MAXIMO / 1024 / 1024) })}
        </p>
      </div>

      {envios.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {envios.map((envio) => (
            <li
              key={envio.chave}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3",
                envio.error
                  ? "border-error-200 bg-error-50 dark:border-error-500/30 dark:bg-error-500/10"
                  : "border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">
                  {envio.name}
                </p>
                {envio.error ? (
                  <p className="text-theme-xs text-error-600 dark:text-error-400">{envio.error}</p>
                ) : (
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                    role="progressbar"
                    aria-label={t("progress", { name: envio.name })}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(envio.progresso * 100)}
                  >
                    <div
                      className="h-full rounded-full bg-brand-500 transition-[width]"
                      style={{ width: `${Math.round(envio.progresso * 100)}%` }}
                    />
                  </div>
                )}
              </div>
              {envio.error && (
                <button
                  type="button"
                  onClick={() => remover(envio.chave)}
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
