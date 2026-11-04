import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import {
  useAtualizarProjeto,
  useCriarProjeto,
  useProjeto,
} from "@/features/projetos/api";
import ProjetoForm from "@/features/projetos/components/ProjetoForm";
import {
  toFormValues,
  toProjetoInput,
  type ProjetoFormValues,
} from "@/features/projetos/schema";
import { useProjetoAtual } from "@/features/projetos/useProjetoAtual";
import { ApiError } from "@/lib/api/http";
import NotFound from "@/pages/OtherPage/NotFound";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";

/** /projects/new (sem id) e /projects/:id (edição) */
export default function ProjetoFormPage() {
  const { id } = useParams();
  const { t } = useTranslation("app", { keyPrefix: "projects" });
  const navigate = useNavigate();
  const { selecionar } = useProjetoAtual();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const projeto = useProjeto(id);
  const criar = useCriarProjeto();
  const atualizar = useAtualizarProjeto();

  const isEdicao = Boolean(id);
  const titulo = isEdicao ? t("editTitle") : t("newTitle");

  const onSubmit = async (values: ProjetoFormValues) => {
    setSubmitError(null);
    try {
      if (id) {
        await atualizar.mutateAsync({ id, input: toProjetoInput(values) });
      } else {
        const novo = await criar.mutateAsync(toProjetoInput(values));
        // Quem cria um projeto quer trabalhar nele
        selecionar(novo.id);
      }
      navigate("/projects");
    } catch {
      setSubmitError(t("form.saveError"));
    }
  };

  if (isEdicao && projeto.error instanceof ApiError && projeto.error.status === 404) {
    return <NotFound />;
  }

  return (
    <>
      <PageMeta title={`${titulo} | PostPilot`} description={t("subtitle")} />
      <PageBreadcrumb pageTitle={titulo} />

      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-5 sm:p-8 dark:border-gray-800 dark:bg-white/3">
        {isEdicao && projeto.isLoading ? (
          <div className="space-y-4" aria-hidden>
            <div className="h-11 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            <div className="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            <div className="h-40 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          </div>
        ) : isEdicao && projeto.isError ? (
          <p role="alert" className="text-sm text-error-600">
            {t("loadError")}
          </p>
        ) : (
          <ProjetoForm
            // Remonta quando os dados chegam, para preencher o formulário
            key={projeto.data?.id ?? "novo"}
            defaultValues={toFormValues(projeto.data)}
            onSubmit={onSubmit}
            submitLabel={isEdicao ? t("form.save") : t("form.create")}
            submitError={submitError}
          />
        )}
      </div>
    </>
  );
}
