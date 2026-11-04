import ConfirmarExclusaoModal from "@/components/common/ConfirmarExclusaoModal";
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
import { useEnviarImagem, useExcluirImagem, useImagens } from "../api";
import { ACCEPT, TAMANHO_MAXIMO } from "../arquivo";
import type { Imagem } from "../types";

type Envio = {
  chave: string;
  name: string;
  progresso: number;
  erro: string | null;
};

/**
 * Biblioteca de imagens do projeto: envio direto para o S3, miniaturas,
 * ampliação (com os posts que usam a imagem) e exclusão.
 */
export default function GaleriaImagens({ projetoId }: { projetoId: string }) {
  const { t } = useTranslation("app", { keyPrefix: "images" });
  const fmt = useFormat();
  const imagens = useImagens(projetoId);
  const posts = usePosts(projetoId);
  const enviar = useEnviarImagem();
  const excluir = useExcluirImagem();
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [ampliada, setAmpliada] = useState<Imagem | null>(null);
  const [aExcluir, setAExcluir] = useState<Imagem | null>(null);

  const postsQueUsam = (imagemId: string) =>
    posts.data?.filter((p) => p.image_ids.includes(imagemId)) ?? [];
  const maxMb = fmt.number(TAMANHO_MAXIMO / 1024 / 1024);

  const atualizar = (chave: string, mudanca: Partial<Envio>) =>
    setEnvios((atual) =>
      atual.map((e) => (e.chave === chave ? { ...e, ...mudanca } : e)),
    );
  const remover = (chave: string) =>
    setEnvios((atual) => atual.filter((e) => e.chave !== chave));

  const motivo = (codigo: string | undefined) => {
    if (codigo === "file-too-large") return t("tooLarge", { max: maxMb });
    if (codigo === "file-invalid-type") return t("invalidType");
    return t("failed");
  };

  const onDrop = (aceitos: File[], rejeitados: FileRejection[]) => {
    const novos: Envio[] = aceitos.map((f) => ({
      chave: crypto.randomUUID(),
      name: f.name,
      progresso: 0,
      erro: null,
    }));
    const recusados: Envio[] = rejeitados.map((r) => ({
      chave: crypto.randomUUID(),
      name: r.file.name,
      progresso: 0,
      erro: motivo(r.errors[0]?.code),
    }));
    setEnvios((atual) => [...atual, ...novos, ...recusados]);

    aceitos.forEach((arquivo, i) => {
      const { chave } = novos[i];
      enviar.mutate(
        {
          projetoId,
          arquivo,
          onProgress: (p) => atualizar(chave, { progresso: p }),
        },
        {
          onSuccess: () => remover(chave),
          onError: () => atualizar(chave, { erro: t("failed") }),
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

  if (imagens.isError) {
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

        {imagens.isLoading &&
          [0, 1, 2].map((i) => (
            <li
              key={i}
              aria-hidden
              className="aspect-square animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
            />
          ))}

        {imagens.data?.map((imagem, i) => {
          const usos = postsQueUsam(imagem.id).length;
          return (
            <li key={imagem.id} className="relative">
              <button
                type="button"
                onClick={() => setAmpliada(imagem)}
                aria-label={t("open", { n: i + 1 })}
                className="block aspect-square w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
              >
                <img
                  src={imagem.url}
                  alt={imagem.description ?? ""}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
              {usos > 0 && (
                <span className="pointer-events-none absolute start-2 top-2">
                  <Badge color="info" size="sm">
                    {t("usedIn", { count: usos })}
                  </Badge>
                </span>
              )}
              <button
                type="button"
                onClick={() => setAExcluir(imagem)}
                aria-label={t("deleteLabel", { n: i + 1 })}
                className="absolute end-2 top-2 flex size-8 items-center justify-center rounded-lg bg-white/90 text-gray-600 shadow-theme-xs hover:text-error-500 dark:bg-gray-900/90 dark:text-gray-300"
              >
                <TrashBinIcon className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>

      {!imagens.isLoading &&
        imagens.data?.length === 0 &&
        envios.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t("empty")}
          </p>
        )}

      {envios.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {envios.map((envio) => (
            <li
              key={envio.chave}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-2.5",
                envio.erro
                  ? "border-error-200 bg-error-50 dark:border-error-500/30 dark:bg-error-500/10"
                  : "border-gray-200 dark:border-gray-800",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-gray-800 dark:text-white/90">
                  {envio.name}
                </p>
                {envio.erro ? (
                  <p className="text-theme-xs text-error-600 dark:text-error-400">
                    {envio.erro}
                  </p>
                ) : (
                  <div
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
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
              {envio.erro && (
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

      <Modal
        isOpen={Boolean(ampliada)}
        onClose={() => setAmpliada(null)}
        className="m-4 max-w-[720px] p-4 sm:p-6"
      >
        {ampliada && (
          <figure>
            <img
              src={ampliada.url}
              alt={ampliada.description ?? ""}
              className="mx-auto max-h-[65vh] rounded-xl object-contain"
            />
            <figcaption className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
              {ampliada.description && (
                <p className="font-medium text-gray-800 dark:text-white/90">
                  {ampliada.description}
                </p>
              )}
              <p className="text-theme-xs">
                {t("uploadedOn", {
                  date: fmt.date(ampliada.created_at, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  }),
                })}
              </p>
              {postsQueUsam(ampliada.id).length > 0 ? (
                <div>
                  <p className="text-theme-xs font-medium">{t("usedBy")}</p>
                  <ul className="mt-1 space-y-0.5">
                    {postsQueUsam(ampliada.id).map((p) => (
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

      <ConfirmarExclusaoModal
        isOpen={Boolean(aExcluir)}
        title={t("deleteTitle")}
        message={t("deleteMessage")}
        conflictMessage={t("deleteConflict")}
        onConfirm={() => excluir.mutateAsync(aExcluir!.id)}
        onClose={() => setAExcluir(null)}
      />
    </div>
  );
}
