import PageHeader from "@/components/common/PageHeader";
import PageMeta from "@/components/common/PageMeta";
import { alertErrorClass, cardClass } from "@/components/common/styles";
import Button from "@/components/ui/button/Button";
import { useRun, useRunAgent } from "@/features/agent/api";
import RunCard from "@/features/agent/components/RunCard";
import { useCurrentProject } from "@/features/projects/useCurrentProject";
import { AiIcon, PaperPlaneIcon } from "@/icons";
import type { AgentMode } from "@/lib/domain";
import { cn } from "@/utils";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

const MODES: AgentMode[] = ["ideation", "creation"];
const MAX_REQUEST = 2000;

export default function Agent() {
  const { t } = useTranslation("app", { keyPrefix: "agent" });
  const { t: tApp } = useTranslation("app");
  const { currentProject } = useCurrentProject();
  const [params, setParams] = useSearchParams();
  const mode: AgentMode =
    params.get("mode") === "creation" ? "creation" : "ideation";

  // Runs made in this visit, per project (each request is independent)
  const [conversation, setConversation] = useState<
    { id: string; projectId: string }[]
  >([]);
  const [request, setRequest] = useState("");
  const startRun = useRunAgent();
  const endRef = useRef<HTMLDivElement>(null);

  const ofProject = conversation.filter(
    (c) => c.projectId === currentProject?.id,
  );
  const last = useRun(ofProject.at(-1)?.id);
  const busy = startRun.isPending || last.data?.status === "running";

  // Scrolls to the last message when the conversation or the steps change
  // (doesn't scroll when the page opens with an empty conversation)
  const visibleSteps = last.data?.steps.length ?? 0;
  const hasConversation = ofProject.length > 0;
  useEffect(() => {
    if (hasConversation)
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [hasConversation, ofProject.length, visibleSteps, last.data?.status]);

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    const text = request.trim();
    if (!text || busy || !currentProject) return;
    startRun.mutate(
      { project_id: currentProject.id, mode, request: text },
      {
        onSuccess: (run) => {
          setConversation((current) => [
            ...current,
            { id: run.id, projectId: run.project_id },
          ]);
          setRequest("");
        },
      },
    );
  };

  const suggestions = t(`suggestions.${mode}`, {
    returnObjects: true,
  }) as string[];

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
          <div
            role="radiogroup"
            aria-label={t("modeLabel")}
            className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-gray-900"
          >
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setParams({ mode: m }, { replace: true })}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  mode === m
                    ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white",
                )}
              >
                {tApp(`domain.agentMode.${m}`)}
              </button>
            ))}
          </div>
        }
      />

      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        {ofProject.length === 0 ? (
          <div className={`${cardClass} px-6 py-10 text-center`}>
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
              <AiIcon className="size-7" />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-gray-800 dark:text-white/90">
              {t(`intro.${mode}.title`)}
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500 dark:text-gray-400">
              {t(`intro.${mode}.message`)}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRequest(s)}
                  className="rounded-full border border-gray-200 px-4 py-2 text-start text-sm text-gray-700 hover:border-brand-300 hover:bg-brand-50 dark:border-gray-800 dark:text-gray-300 dark:hover:border-brand-800 dark:hover:bg-brand-500/10"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8" aria-live="polite">
            {ofProject.map((c) => (
              <RunCard key={c.id} id={c.id} />
            ))}
          </div>
        )}

        {startRun.isError && (
          <p role="alert" className={alertErrorClass}>
            {t("sendError")}
          </p>
        )}

        <form onSubmit={send} className={`${cardClass} p-3`}>
          <label htmlFor="request" className="sr-only">
            {t("inputLabel")}
          </label>
          <textarea
            id="request"
            rows={3}
            value={request}
            maxLength={MAX_REQUEST}
            onChange={(e) => setRequest(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia; Shift+Enter quebra a linha
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={t(`placeholder.${mode}`)}
            className="w-full resize-none border-0 bg-transparent px-2 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-0 focus:outline-hidden dark:text-white/90 dark:placeholder:text-white/30"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-2 pt-3 dark:border-gray-800">
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              {t("draftOnly")}{" "}
              <Link
                to="/agent/runs"
                className="text-brand-500 hover:underline dark:text-brand-400"
              >
                {t("history")}
              </Link>
            </p>
            <Button
              size="sm"
              disabled={!request.trim() || busy}
              startIcon={<PaperPlaneIcon className="size-4" />}
            >
              {busy ? t("working") : t("send")}
            </Button>
          </div>
        </form>
        <div ref={endRef} />
      </div>
    </>
  );
}
