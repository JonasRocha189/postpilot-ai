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
import Button from "@/components/ui/button/Button";
import { useAssuntos } from "@/features/assuntos/api";
import {
  useCreateIdea,
  useDeleteIdea,
  useIdeas,
  useUpdateIdea,
} from "@/features/ideas/api";
import IdeaFormModal from "@/features/ideas/components/IdeaFormModal";
import type { Idea, IdeaInput } from "@/features/ideas/types";
import { useProjetoAtual } from "@/features/projetos/useProjetoAtual";
import { PencilIcon, PlusIcon, TrashBinIcon } from "@/icons";
import { REDE_LABEL } from "@/lib/dominio";
import { cn } from "@/utils";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

const FILTERS = ["open", "used", "all"] as const;
type Filter = (typeof FILTERS)[number];

/**
 * Ideas: possible posts before they are written, by the user or suggested by
 * the agent. "Create post" opens the post form filled in from the idea.
 */
export default function Ideas() {
  const { t } = useTranslation("app", { keyPrefix: "ideas" });
  const { projetoAtual } = useProjetoAtual();
  const projectId = projetoAtual?.id;
  const ideas = useIdeas(projectId);
  const subjects = useAssuntos(projectId);
  const create = useCreateIdea();
  const update = useUpdateIdea();
  const remove = useDeleteIdea();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Idea | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Idea | null>(null);

  // Filter in the URL, like the posts list (open ideas by default)
  const filterParam = params.get("show");
  const filter: Filter = FILTERS.includes(filterParam as Filter)
    ? (filterParam as Filter)
    : "open";
  const setFilter = (next: Filter) =>
    setParams(next === "open" ? {} : { show: next }, { replace: true });

  const visible = (ideas.data ?? []).filter((idea) =>
    filter === "all" ? true : filter === "used" ? idea.post_id : !idea.post_id,
  );
  const subjectName = (id: string | null) =>
    id ? subjects.data?.find((s) => s.id === id)?.name : undefined;

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const save = (input: IdeaInput) =>
    editing
      ? update.mutateAsync({
          id: editing.id,
          input: { ...input, post_id: editing.post_id },
        })
      : create.mutateAsync({ projectId: projectId!, input });

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
          <Button onClick={openNew} startIcon={<PlusIcon className="size-5" />}>
            {t("new")}
          </Button>
        }
      />

      <div
        role="group"
        aria-label={t("filterLabel")}
        className="mb-5 inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900"
      >
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md px-3 py-2 text-theme-sm font-medium",
              filter === f
                ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
            )}
          >
            {t(`filters.${f}`)}
          </button>
        ))}
      </div>

      {ideas.isLoading ? (
        <div
          aria-hidden
          className="h-48 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800"
        />
      ) : ideas.isError ? (
        <p role="alert" className="text-sm text-error-600">
          {t("loadError")}
        </p>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center dark:border-gray-700 dark:bg-white/3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filter === "open" ? t("emptyOpen") : t("empty")}
          </p>
          <p className="mx-auto mt-1 max-w-md text-theme-xs text-gray-500 dark:text-gray-400">
            {t("agentHint")}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((idea) => (
            <li key={idea.id} className={`${cardClass} flex flex-col p-5`}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                  {idea.title}
                </h3>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(idea);
                      setFormOpen(true);
                    }}
                    className={iconButtonClass}
                    aria-label={t("editLabel", { name: idea.title })}
                    title={t("edit")}
                  >
                    <PencilIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setToDelete(idea)}
                    className={iconButtonDangerClass}
                    aria-label={t("deleteLabel", { name: idea.title })}
                    title={t("delete.confirm")}
                  >
                    <TrashBinIcon className="size-4" />
                  </button>
                </div>
              </div>

              {idea.notes && (
                <p className="mt-2 line-clamp-3 text-sm whitespace-pre-line text-gray-600 dark:text-gray-400">
                  {idea.notes}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {idea.source === "agent" && (
                  <Badge color="info" size="sm">
                    {t("fromAgent")}
                  </Badge>
                )}
                {subjectName(idea.subject_id) && (
                  <Badge color="light" size="sm">
                    {subjectName(idea.subject_id)}
                  </Badge>
                )}
                {idea.networks.map((n) => (
                  <Badge key={n} color="primary" size="sm">
                    {REDE_LABEL[n]}
                  </Badge>
                ))}
              </div>

              <div className="mt-auto pt-5">
                {idea.post_id ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge color="success" size="sm">
                      {t("used")}
                    </Badge>
                    <Link
                      to={`/posts/${idea.post_id}`}
                      className="text-theme-sm font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
                    >
                      {t("openPost")}
                    </Link>
                  </div>
                ) : (
                  <Link
                    to={`/posts/new?idea=${idea.id}`}
                    className={primaryLinkClass}
                    aria-label={t("createPostLabel", { name: idea.title })}
                  >
                    {t("createPost")}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <IdeaFormModal
        isOpen={formOpen}
        idea={editing}
        subjects={subjects.data ?? []}
        onSave={save}
        onClose={() => setFormOpen(false)}
      />
      <ConfirmarExclusaoModal
        isOpen={toDelete !== null}
        title={t("delete.title", { name: toDelete?.title })}
        message={
          toDelete?.post_id ? t("delete.messageUsed") : t("delete.message")
        }
        onConfirm={() => remove.mutateAsync(toDelete!.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
