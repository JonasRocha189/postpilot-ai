import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import PageMeta from "@/components/common/PageMeta";
import { useAssunto, useAssuntos } from "@/features/assuntos/api";
import { useIdea, useUpdateIdea } from "@/features/ideas/api";
import { useAtualizarPost, useCriarPost, usePost } from "@/features/posts/api";
import PostForm from "@/features/posts/components/PostForm";
import {
  fromIdea,
  toFormValues,
  toPostInput,
  type PostFormValues,
} from "@/features/posts/schema";
import { useProjetoAtual } from "@/features/projetos/useProjetoAtual";
import { ApiError } from "@/lib/api/http";
import { REDES } from "@/features/posts/redes";
import NotFound from "@/pages/OtherPage/NotFound";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router";

/** /posts/new (sem id) e /posts/:id (edição). */
export default function PostFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { t } = useTranslation("app", { keyPrefix: "posts" });
  const navigate = useNavigate();
  const location = useLocation();
  const acabouDeCriar =
    (location.state as { criado?: boolean } | null)?.criado === true;
  const { projetoAtual } = useProjetoAtual();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isEdicao = Boolean(id);
  const post = usePost(id);
  // Na edição, os assuntos oferecidos são os do projeto do post
  const assuntoDoPost = useAssunto(post.data?.subject_id);
  const projetoId = isEdicao
    ? assuntoDoPost.data?.project_id
    : projetoAtual?.id;
  const assuntos = useAssuntos(projetoId);

  // /posts/new?idea=…: the post starts from an idea (Ideas page)
  const ideaId = isEdicao ? null : params.get("idea");
  const idea = useIdea(ideaId);
  const updateIdea = useUpdateIdea();

  const criar = useCriarPost();
  const atualizar = useAtualizarPost();
  const titulo = isEdicao ? t("editTitle") : t("newTitle");

  const onSubmit = async (values: PostFormValues) => {
    setSubmitError(null);
    try {
      if (id) {
        await atualizar.mutateAsync({ id, input: toPostInput(values) });
        navigate("/posts");
      } else {
        const criado = await criar.mutateAsync(toPostInput(values));
        if (idea.data) {
          // The idea now points to its post. If this fails, the post is
          // already saved: the idea just stays open (it can be retried later).
          const { title, notes, subject_id, networks } = idea.data;
          await updateIdea
            .mutateAsync({
              id: idea.data.id,
              input: { title, notes, subject_id, networks, post_id: criado.id },
            })
            .catch(() => undefined);
        }
        navigate("/posts");
      }
    } catch {
      setSubmitError(t("saveError"));
    }
  };

  if (isEdicao && post.error instanceof ApiError && post.error.status === 404) {
    return <NotFound />;
  }

  const carregando =
    (isEdicao && (post.isLoading || assuntoDoPost.isLoading)) ||
    (Boolean(ideaId) && idea.isLoading) ||
    assuntos.isLoading ||
    !assuntos.data;
  const erro = (isEdicao && post.isError) || assuntos.isError;
  // ?subject=… pré-seleciona o assunto (ex.: vindo da lista filtrada)
  const assuntoPadrao = params.get("subject") ?? "";
  // ?network=… opens that variation's tab (e.g. coming from the calendar)
  const networkParam = params.get("network");
  const initialNetwork = REDES.find((n) => n === networkParam) ?? null;

  return (
    <>
      <PageMeta title={`${titulo} | PostPilot`} description={t("subtitle")} />
      <PageBreadcrumb pageTitle={titulo} />

      <div className="mx-auto max-w-4xl">
        {erro ? (
          <p role="alert" className="text-sm text-error-600">
            {t("loadError")}
          </p>
        ) : carregando ? (
          <div className="space-y-6" aria-hidden>
            <div className="h-56 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          </div>
        ) : (
          <>
            {acabouDeCriar && (
              <p
                role="status"
                className="mb-6 rounded-lg border border-success-500 bg-success-50 p-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/15 dark:text-success-400"
              >
                {t("form.created")}
              </p>
            )}
            <PostForm
              projetoId={projetoId!}
              key={post.data?.id ?? idea.data?.id ?? "novo"}
              assuntos={assuntos.data ?? []}
              defaultValues={
                idea.data && !isEdicao
                  ? fromIdea(idea.data)
                  : toFormValues(post.data, assuntoPadrao)
              }
              initialNetwork={initialNetwork}
              onSubmit={onSubmit}
              submitLabel={isEdicao ? t("save") : t("create")}
              submitError={submitError}
            />
          </>
        )}
      </div>
    </>
  );
}
