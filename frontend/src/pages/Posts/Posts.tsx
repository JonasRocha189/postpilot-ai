import ConfirmDeleteModal from "@/components/common/ConfirmDeleteModal";
import PageHeader from "@/components/common/PageHeader";
import PageMeta from "@/components/common/PageMeta";
import {
  cardClass,
  iconButtonClass,
  iconButtonDangerClass,
  primaryLinkClass,
} from "@/components/common/styles";
import Badge from "@/components/ui/badge/Badge";
import { useSubjects } from "@/features/subjects/api";
import { useDeletePost, usePosts } from "@/features/posts/api";
import { NETWORKS } from "@/features/posts/networks";
import type { Post, PostFilters, PostVariation } from "@/features/posts/types";
import { useCurrentProject } from "@/features/projects/useCurrentProject";
import { PencilIcon, PlusIcon, TrashBinIcon } from "@/icons";
import {
  NETWORK_LABEL,
  POST_STATUS,
  POST_STATUS_COLOR,
  type Network,
  type PostStatus,
} from "@/lib/domain";
import { useFormat } from "@/lib/format";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

const th =
  "px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400";
const td = "px-5 py-4 align-middle text-sm text-gray-600 dark:text-gray-400";
const filterClass =
  "h-11 rounded-lg border border-gray-300 bg-transparent ps-3 pe-9 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

export default function Posts() {
  const { t } = useTranslation("app", { keyPrefix: "posts" });
  const { t: tApp } = useTranslation("app");
  const fmt = useFormat();
  const { currentProject } = useCurrentProject();
  const [params, setParams] = useSearchParams();
  const remove = useDeletePost();
  const [toDelete, setToDelete] = useState<Post | null>(null);

  // Filters in the URL: shareable links, and the back button works
  const statusParam = params.get("status");
  const networkParam = params.get("network");
  const filters: PostFilters = {
    status: POST_STATUS.includes(statusParam as PostStatus)
      ? (statusParam as PostStatus)
      : undefined,
    network: NETWORKS.includes(networkParam as Network)
      ? (networkParam as Network)
      : undefined,
    subject_id: params.get("subject") ?? undefined,
  };
  const hasFilter = Boolean(
    filters.status || filters.network || filters.subject_id,
  );

  const data = (iso: string | null) =>
    iso
      ? fmt.date(iso, { day: "2-digit", month: "short", year: "numeric" })
      : t("noDate");

  const subjects = useSubjects(currentProject?.id);
  const posts = usePosts(currentProject?.id, filters);
  const subjectName = (id: string) =>
    subjects.data?.find((a) => a.id === id)?.name ?? "—";
  /** "Instagram · Carrossel · 20 nov" */
  const variationLabel = (v: PostVariation) =>
    [
      NETWORK_LABEL[v.network],
      t(`form.formats.${v.network}.${v.format}.label`),
      data(v.expected_date),
    ].join(" · ");
  const variationsList = (post: Post) => (
    <ul className="flex flex-col gap-1.5">
      {post.variations.map((v) => (
        <li key={v.id} className="flex flex-wrap items-center gap-2">
          <Link
            to={`/posts/${post.id}?network=${v.network}`}
            className="text-theme-sm text-gray-700 hover:text-brand-500 dark:text-gray-300 dark:hover:text-brand-400"
          >
            {variationLabel(v)}
          </Link>
          <Badge color={POST_STATUS_COLOR[v.status]} size="sm">
            {tApp(`domain.postStatus.${v.status}`)}
          </Badge>
        </li>
      ))}
    </ul>
  );
  const noSubjects = subjects.isSuccess && subjects.data.length === 0;

  const setFilter = (key: "status" | "network" | "subject", value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageMeta
        title={`${t("title")} | PostPilot`}
        description={t("subtitle")}
      />
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { project: currentProject?.name })}
        action={
          !noSubjects && (
            <Link to="/posts/new" className={primaryLinkClass}>
              <PlusIcon className="size-5" />
              {t("new")}
            </Link>
          )
        }
      />

      {noSubjects ? (
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
                className={filterClass}
                value={filters.status ?? ""}
                onChange={(e) => setFilter("status", e.target.value)}
              >
                <option value="">{t("filters.all")}</option>
                {POST_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {tApp(`domain.postStatus.${s}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">
              {t("filters.network")}
              <select
                className={filterClass}
                value={filters.network ?? ""}
                onChange={(e) => setFilter("network", e.target.value)}
              >
                <option value="">{t("filters.all")}</option>
                {NETWORKS.map((r) => (
                  <option key={r} value={r}>
                    {NETWORK_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-400">
              {t("filters.subject")}
              <select
                className={`${filterClass} max-w-full`}
                value={filters.subject_id ?? ""}
                onChange={(e) => setFilter("subject", e.target.value)}
              >
                <option value="">{t("filters.all")}</option>
                {subjects.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            {hasFilter && (
              <button
                type="button"
                onClick={() => setParams({}, { replace: true })}
                className="h-11 rounded-lg px-3 text-sm font-medium text-brand-500 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
              >
                {t("filters.clear")}
              </button>
            )}
          </div>

          {posts.isLoading || subjects.isLoading ? (
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
                {hasFilter ? t("emptyFiltered") : t("empty")}
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
                      <th className={`${th} hidden sm:table-cell`}>
                        {t("columns.variations")}
                      </th>
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
                          {/* On phones, the hidden columns show up here */}
                          <p className="mt-0.5 text-theme-xs text-gray-500 md:hidden dark:text-gray-400">
                            {subjectName(post.subject_id)}
                          </p>
                          <div className="mt-2 sm:hidden">
                            {variationsList(post)}
                          </div>
                        </td>
                        <td className={`${td} hidden md:table-cell`}>
                          {subjectName(post.subject_id)}
                        </td>
                        <td className={`${td} hidden sm:table-cell`}>
                          {variationsList(post)}
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
                              onClick={() => setToDelete(post)}
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

      <ConfirmDeleteModal
        isOpen={toDelete !== null}
        title={t("delete.title", { name: toDelete?.title })}
        message={t("delete.message")}
        onConfirm={() => remove.mutateAsync(toDelete!.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
