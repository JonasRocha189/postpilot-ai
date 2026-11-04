import ConfirmarExclusaoModal from "@/components/common/ConfirmarExclusaoModal";
import PageHeader from "@/components/common/PageHeader";
import PageMeta from "@/components/common/PageMeta";
import { cardClass, iconButtonDangerClass } from "@/components/common/styles";
import Badge from "@/components/ui/badge/Badge";
import { useDocumentos, useExcluirDocumento } from "@/features/documentos/api";
import UploadArea from "@/features/documentos/components/UploadArea";
import type { Documento } from "@/features/documentos/types";
import { useProjetoAtual } from "@/features/projetos/useProjetoAtual";
import { FileIcon, TrashBinIcon } from "@/icons";
import { STATUS_DOCUMENTO_COR } from "@/lib/dominio";
import { useFormat } from "@/lib/format";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const th =
  "px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400";
const td = "px-5 py-4 align-middle text-sm text-gray-600 dark:text-gray-400";

export default function Documentos() {
  const { t } = useTranslation("app", { keyPrefix: "documents" });
  const { t: tApp } = useTranslation("app");
  const fmt = useFormat();
  const { projetoAtual } = useProjetoAtual();
  const { data: documentos = [], isLoading, isError } = useDocumentos(projetoAtual?.id);
  const excluir = useExcluirDocumento();
  const [paraExcluir, setParaExcluir] = useState<Documento | null>(null);

  const tamanho = (bytes: number) =>
    bytes >= 1024 * 1024
      ? `${fmt.number(Math.round((bytes / 1024 / 1024) * 10) / 10)} MB`
      : `${fmt.number(Math.max(1, Math.round(bytes / 1024)))} KB`;

  return (
    <>
      <PageMeta title={`${t("title")} | PostPilot`} description={t("subtitle")} />
      <PageHeader title={t("title")} subtitle={t("subtitle", { project: projetoAtual?.name })} />

      <div className="space-y-6">
        {projetoAtual && <UploadArea projetoId={projetoAtual.id} />}

        {isLoading ? (
          <div aria-hidden className="h-48 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        ) : isError ? (
          <p role="alert" className="text-sm text-error-600">
            {t("loadError")}
          </p>
        ) : documentos.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t("empty")}</p>
        ) : (
          <div className={`${cardClass} overflow-hidden`}>
            <div className="max-w-full overflow-x-auto">
              <table className="min-w-full">
                <thead className="border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className={th}>{t("columns.name")}</th>
                    <th className={`${th} hidden sm:table-cell`}>{t("columns.size")}</th>
                    <th className={`${th} hidden md:table-cell`}>{t("columns.chunks")}</th>
                    <th className={`${th} hidden lg:table-cell`}>{t("columns.uploaded")}</th>
                    <th className={th}>{t("columns.status")}</th>
                    <th className={th}>
                      <span className="sr-only">{t("columns.actions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {documentos.map((doc) => (
                    <tr key={doc.id}>
                      <td className={td}>
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[10px] font-bold text-gray-600 uppercase dark:bg-gray-800 dark:text-gray-300">
                            {doc.tipo}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-gray-800 dark:text-white/90">
                              {doc.name}
                            </p>
                            {doc.status === "error" && doc.mensagem_erro && (
                              <p className="text-theme-xs text-error-600 dark:text-error-400">
                                {doc.mensagem_erro}
                              </p>
                            )}
                            <p className="text-theme-xs text-gray-500 sm:hidden dark:text-gray-400">
                              {tamanho(doc.tamanho_bytes)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={`${td} hidden whitespace-nowrap sm:table-cell`}>
                        {tamanho(doc.tamanho_bytes)}
                      </td>
                      <td className={`${td} hidden tabular-nums md:table-cell`}>
                        {doc.total_chunks ?? "—"}
                      </td>
                      <td className={`${td} hidden whitespace-nowrap lg:table-cell`}>
                        {fmt.relative(doc.created_at)}
                      </td>
                      <td className={td}>
                        <span className="inline-flex items-center gap-2">
                          {(doc.status === "processing" || doc.status === "pending") && (
                            <span
                              aria-hidden
                              className="size-3.5 animate-spin rounded-full border-2 border-gray-200 border-t-brand-500 dark:border-gray-700"
                            />
                          )}
                          <Badge color={STATUS_DOCUMENTO_COR[doc.status]} size="sm">
                            {tApp(`domain.docStatus.${doc.status}`)}
                          </Badge>
                        </span>
                      </td>
                      <td className={td}>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => setParaExcluir(doc)}
                            className={iconButtonDangerClass}
                            aria-label={t("deleteLabel", { name: doc.name })}
                            title={t("delete.confirm")}
                          >
                            <TrashBinIcon className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="flex items-start gap-2 text-theme-xs text-gray-500 dark:text-gray-400">
          <FileIcon className="mt-0.5 size-4 shrink-0" />
          {t("ragHint")}
        </p>
      </div>

      <ConfirmarExclusaoModal
        isOpen={paraExcluir !== null}
        title={t("delete.title", { name: paraExcluir?.name })}
        message={t("delete.message")}
        onConfirm={() => excluir.mutateAsync(paraExcluir!.id)}
        onClose={() => setParaExcluir(null)}
      />
    </>
  );
}
