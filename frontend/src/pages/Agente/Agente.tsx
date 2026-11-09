import PageHeader from "@/components/common/PageHeader";
import PageMeta from "@/components/common/PageMeta";
import { alertErrorClass, cardClass } from "@/components/common/styles";
import Button from "@/components/ui/button/Button";
import { useExecucao, useExecutarAgente } from "@/features/agente/api";
import ExecucaoCard from "@/features/agente/components/ExecucaoCard";
import { useProjetoAtual } from "@/features/projetos/useProjetoAtual";
import { AiIcon, PaperPlaneIcon } from "@/icons";
import type { ModoAgente } from "@/lib/dominio";
import { cn } from "@/utils";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";

const MODOS: ModoAgente[] = ["ideation", "creation"];
const MAX_PEDIDO = 2000;

export default function Agente() {
  const { t } = useTranslation("app", { keyPrefix: "agent" });
  const { t: tApp } = useTranslation("app");
  const { projetoAtual } = useProjetoAtual();
  const [params, setParams] = useSearchParams();
  const mode: ModoAgente = params.get("mode") === "creation" ? "creation" : "ideation";

  // Execuções feitas nesta visita, por projeto (cada request é independente)
  const [conversa, setConversa] = useState<{ id: string; projetoId: string }[]>([]);
  const [request, setPedido] = useState("");
  const executar = useExecutarAgente();
  const fimRef = useRef<HTMLDivElement>(null);

  const doProjeto = conversa.filter((c) => c.projetoId === projetoAtual?.id);
  const ultima = useExecucao(doProjeto.at(-1)?.id);
  const ocupado = executar.isPending || ultima.data?.status === "running";

  // Rola até a última mensagem quando a conversa ou os passos mudam
  // (não rola ao abrir a página, com a conversa vazia)
  const passosVisiveis = ultima.data?.steps.length ?? 0;
  const temConversa = doProjeto.length > 0;
  useEffect(() => {
    if (temConversa) fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [temConversa, doProjeto.length, passosVisiveis, ultima.data?.status]);

  const enviar = (e?: FormEvent) => {
    e?.preventDefault();
    const texto = request.trim();
    if (!texto || ocupado || !projetoAtual) return;
    executar.mutate(
      { project_id: projetoAtual.id, mode, request: texto },
      {
        onSuccess: (execucao) => {
          setConversa((atual) => [...atual, { id: execucao.id, projetoId: execucao.project_id }]);
          setPedido("");
        },
      },
    );
  };

  const sugestoes = t(`suggestions.${mode}`, { returnObjects: true }) as string[];

  return (
    <>
      <PageMeta title={`${t("title")} | PostPilot`} description={t("subtitle")} />
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { project: projetoAtual?.name })}
        action={
          <div
            role="radiogroup"
            aria-label={t("modeLabel")}
            className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-gray-900"
          >
            {MODOS.map((m) => (
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
        {doProjeto.length === 0 ? (
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
              {sugestoes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPedido(s)}
                  className="rounded-full border border-gray-200 px-4 py-2 text-start text-sm text-gray-700 hover:border-brand-300 hover:bg-brand-50 dark:border-gray-800 dark:text-gray-300 dark:hover:border-brand-800 dark:hover:bg-brand-500/10"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8" aria-live="polite">
            {doProjeto.map((c) => (
              <ExecucaoCard key={c.id} id={c.id} />
            ))}
          </div>
        )}

        {executar.isError && (
          <p role="alert" className={alertErrorClass}>
            {t("sendError")}
          </p>
        )}

        <form onSubmit={enviar} className={`${cardClass} p-3`}>
          <label htmlFor="request" className="sr-only">
            {t("inputLabel")}
          </label>
          <textarea
            id="request"
            rows={3}
            value={request}
            maxLength={MAX_PEDIDO}
            onChange={(e) => setPedido(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia; Shift+Enter quebra a linha
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                enviar();
              }
            }}
            placeholder={t(`placeholder.${mode}`)}
            className="w-full resize-none border-0 bg-transparent px-2 py-1.5 text-sm text-gray-800 placeholder:text-gray-400 focus:ring-0 focus:outline-hidden dark:text-white/90 dark:placeholder:text-white/30"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-2 pt-3 dark:border-gray-800">
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              {t("draftOnly")}{" "}
              <Link to="/agent/runs" className="text-brand-500 hover:underline dark:text-brand-400">
                {t("history")}
              </Link>
            </p>
            <Button
              size="sm"
              disabled={!request.trim() || ocupado}
              startIcon={<PaperPlaneIcon className="size-4" />}
            >
              {ocupado ? t("working") : t("send")}
            </Button>
          </div>
        </form>
        <div ref={fimRef} />
      </div>
    </>
  );
}
