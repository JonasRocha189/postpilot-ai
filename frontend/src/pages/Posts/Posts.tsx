import ConfirmarExclusaoModal from "@/components/common/ConfirmarExclusaoModal";
import PageHeader from "@/components/common/PageHeader";
import PageMeta from "@/components/common/PageMeta";
import {
  cardClass,
  iconButtonClass,
  iconButtonDangerClass,
  primaryLinkClass,
} from "@/components/common/styles";
import Badge from "@/components/ui/badge/Badge";
import { useAssuntos } from "@/features/assuntos/api";
import { useExcluirPost, usePosts } from "@/features/posts/api";
import type { Post, PostFiltros } from "@/features/posts/types";
import { useProjetoAtual } from "@/features/projetos/useProjetoAtual";
import { PencilIcon, PlusIcon, TrashBinIcon } from "@/icons";
import {
  REDE_LABEL,
  STATUS_POST,
  STATUS_POST_COR,
  type StatusPost,
} from "@/lib/dominio";
import { useFormat } from "@/lib/format";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

const th =
  "px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400";
const td = "px-5 py-4 align-middle text-sm text-gray-600 dark:text-gray-400";
const filtroClass =
  "h-11 rounded-lg border border-gray-300 bg-transparent ps-3 pe-9 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

export default function Posts() {
  const { t } = useTranslation("app", { keyPrefix: "posts" });
  const { t: tApp } = useTranslation("app");
  const fmt = useFormat();
  const { projetoAtual } = useProjetoAtual();
  const [params, setParams] = useSearchParams();
  const excluir = useExcluirPost();
  const [paraExcluir, setParaExcluir] = useState<Post | null>(null);

  // Filtros na URL: links compartilháveis e o botão voltar funciona
  const statusParam = params.get("status");
  const filtros: PostFiltros = {
    status: STATUS_POST.includes(statusParam as StatusPost)
      ? (statusParam as StatusPost)
      : undefined,
    subject_id: params.get("subject") ?? undefined,
  };
  const temFiltro = Boolean(filtros.status || filtros.subject_id);

  const assuntos = useAssuntos(projetoAtual?.id);
  const posts = usePosts(projetoAtual?.id, filtros);
  const nomeAssunto = (id: string) =>
    assuntos.data?.find((a) => a.id === id)?.name ?? "—";
  const redeEFormato = (post: Post) =>
    `${REDE_LABEL[post.network]} · ${t(`form.formats.${post.network}.${post.format}.label`)}`;
  const semAssuntos = assuntos.isSuccess && assuntos.data.length === 0;

  const setFiltro = (chave: "status" | "subject", valor: string) => {
    const proximo = new URLSearchParams(params);
    if (valor) proximo.set(chave, valor);
    else proximo.delete(chave);
    setParams(proximo, { replace: true });
  };

  const data = (iso: string | null) =>
    iso
      ? fmt.date(iso, { day: "2-digit", month: "short", year: "numeric" })
      : t("noDate");

  return (
    <>
      <PageMeta
        title={`${t("title")} | PostPilot`}
        description={t("subtitle")}
      />
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { project: projetoAtual?.name })}
        action={
          !semAssuntos && (
            <Link to="/posts/new" className={primaryLinkClass}>
              <PlusIcon className="size-5" />
              {t("new")}
            </Link>
          )
        }
      />

      {semAssuntos ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center dark:border-gray-700 dark:bg-white/3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {t("needSubject.title")}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
            {t("needSubject.message")}
          </p>
          <Link to="/subjects/new" className={`${primaryLinkClass} mt-6`}>
            <PlusIcon className="size-5" />
            {tApp("subjects.new")}
          </Link>
        </div>
      ) : (
        <>
          {/* Filtros */}
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">
              {t("filters.status")}
              <select
                className={filtroClass}
                value={filtros.status ?? ""}
                onChange={(e) => setFiltro("status", e.target.value)}
              >
                <option value="">{t("filters.all")}</option>
                {STATUS_POST.map((s) => (
                  <option key={s} value={s}>
                    {tApp(`domain.postStatus.${s}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">
              {t("filters.subject")}
              <select
                className={`${filtroClass} max-w-full`}
                value={filtros.subject_id ?? ""}
                onChange={(e) => setFiltro("subject", e.target.value)}
              >
                <option value="">{t("filters.all")}</option>
                {assuntos.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            {temFiltro && (
              <button
                type="button"
                onClick={() => setParams({}, { replace: true })}
                className="h-11 rounded-lg px-3 text-sm font-medium text-brand-500 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
              >
                {t("filters.clear")}
              </button>
            )}
          </div>

          {posts.isLoading || assuntos.isLoading ? (
            <div
              aria-hidden
              className="h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800"
            />
          ) : posts.isError ? (
            <p role="alert" className="text-sm text-error-600">
              {t("loadError")}
            </p>
          ) : !posts.data?.length ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center dark:border-gray-700 dark:bg-white/3">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {temFiltro ? t("emptyFiltered") : t("empty")}
              </p>
            </div>
          ) : (
            <div className={`${cardClass} overflow-hidden`}>
              <div className="max-w-full overflow-x-auto">
                <table className="min-w-full">
                  <thead className="border-b border-gray-100 dark:border-gray-800">
                    <tr>
                      <th className={th}>{t("columns.title")}</th>
                      <th className={`${th} hidden md:table-cell`}>
                        {t("columns.subject")}
                      </th>
                      <th className={`${th} hidden lg:table-cell`}>
                        {t("columns.network")}
                      </th>
                      <th className={`${th} hidden sm:table-cell`}>
                        {t("columns.date")}
                      </th>
                      <th className={th}>{t("columns.status")}</th>
                      <th className={th}>
                        <span className="sr-only">{t("columns.actions")}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {posts.data.map((post) => (
                      <tr key={post.id}>
                        <td className={td}>
                          <Link
                            to={`/posts/${post.id}`}
                            className="font-medium text-gray-800 hover:text-brand-500 dark:text-white/90 dark:hover:text-brand-400"
                          >
                            {post.title}
                          </Link>
                          {/* No celular, as colunas ocultas aparecem aqui */}
                          <p className="mt-1 text-theme-xs text-gray-500 sm:hidden dark:text-gray-400">
                            {data(post.expected_date)}
                          </p>
                          <p className="mt-0.5 text-theme-xs text-gray-500 md:hidden dark:text-gray-400">
                            {nomeAssunto(post.subject_id)}
                          </p>
                          <p className="mt-0.5 text-theme-xs text-gray-500 lg:hidden dark:text-gray-400">
                            {redeEFormato(post)}
                          </p>
                        </td>
                        <td className={`${td} hidden md:table-cell`}>
                          {nomeAssunto(post.subject_id)}
                        </td>
                        <td className={`${td} hidden lg:table-cell`}>
                          {redeEFormato(post)}
                        </td>
                        <td
                          className={`${td} hidden whitespace-nowrap sm:table-cell`}
                        >
                          {data(post.expected_date)}
                        </td>
                        <td className={td}>
                          <Badge color={STATUS_POST_COR[post.status]} size="sm">
                            {tApp(`domain.postStatus.${post.status}`)}
                          </Badge>
                        </td>
                        <td className={td}>
                          <div className="flex justify-end gap-2">
                            <Link
                              to={`/posts/${post.id}`}
                              className={iconButtonClass}
                              aria-label={t("editLabel", { name: post.title })}
                              title={t("edit")}
                            >
                              <PencilIcon className="size-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => setParaExcluir(post)}
                              className={iconButtonDangerClass}
                              aria-label={t("deleteLabel", {
                                name: post.title,
                              })}
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
        </>
      )}

      <ConfirmarExclusaoModal
        isOpen={paraExcluir !== null}
        title={t("delete.title", { name: paraExcluir?.title })}
        message={t("delete.message")}
        onConfirm={() => excluir.mutateAsync(paraExcluir!.id)}
        onClose={() => setParaExcluir(null)}
      />
    </>
  );
}
