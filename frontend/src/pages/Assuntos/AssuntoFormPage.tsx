import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import { cardClass } from "@/components/common/styles";
import { useAssunto, useAtualizarAssunto, useCriarAssunto } from "@/features/assuntos/api";
import AssuntoForm from "@/features/assuntos/components/AssuntoForm";
import {
  toAssuntoInput,
  toFormValues,
  type AssuntoFormValues,
} from "@/features/assuntos/schema";
import { useProjetoAtual } from "@/features/projetos/useProjetoAtual";
import { ApiError } from "@/lib/api/http";
import NotFound from "@/pages/OtherPage/NotFound";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";

/** /subjects/new (sem id) e /subjects/:id (edição) */
export default function AssuntoFormPage() {
  const { id } = useParams();
  const { t } = useTranslation("app", { keyPrefix: "subjects" });
  const navigate = useNavigate();
  const { projetos, projetoAtual } = useProjetoAtual();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const assunto = useAssunto(id);
  const criar = useCriarAssunto();
  const atualizar = useAtualizarAssunto();

  const isEdicao = Boolean(id);
  const titulo = isEdicao ? t("editTitle") : t("newTitle");
  // Na edição, a voz herdada é a do projeto do assunto
  const projeto =
    (assunto.data && projetos.find((p) => p.id === assunto.data.project_id)) || projetoAtual;

  const onSubmit = async (values: AssuntoFormValues) => {
    setSubmitError(null);
    try {
      if (id) {
        await atualizar.mutateAsync({ id, input: toAssuntoInput(values) });
      } else {
        await criar.mutateAsync({ projetoId: projetoAtual!.id, input: toAssuntoInput(values) });
      }
      navigate("/subjects");
    } catch {
      setSubmitError(t("saveError"));
    }
  };

  if (isEdicao && assunto.error instanceof ApiError && assunto.error.status === 404) {
    return <NotFound />;
  }

  return (
    <>
      <PageMeta title={`${titulo} | PostPilot`} description={t("subtitle")} />
      <PageBreadcrumb pageTitle={titulo} />

      <div className={`${cardClass} mx-auto max-w-3xl p-5 sm:p-8`}>
        {(isEdicao && assunto.isLoading) || !projeto ? (
          <div className="space-y-4" aria-hidden>
            <div className="h-11 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            <div className="h-40 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          </div>
        ) : isEdicao && assunto.isError ? (
          <p role="alert" className="text-sm text-error-600">
            {t("loadError")}
          </p>
        ) : (
          <AssuntoForm
            key={assunto.data?.id ?? "novo"}
            projeto={projeto}
            defaultValues={toFormValues(assunto.data)}
            onSubmit={onSubmit}
            submitLabel={isEdicao ? t("save") : t("create")}
            submitError={submitError}
          />
        )}
      </div>
    </>
  );
}
