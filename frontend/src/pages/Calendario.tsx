import PageHeader from "@/components/common/PageHeader";
import PageMeta from "@/components/common/PageMeta";
import { useAssuntos } from "@/features/assuntos/api";
import PostDetailsModal from "@/features/calendario/components/PostDetailsModal";
import PostsCalendar from "@/features/calendario/components/PostsCalendar";
import { NIVEL_COR, STATUS_NIVEL } from "@/features/calendario/status";
import type { PostAgendado } from "@/features/calendario/types";
import { usePosts } from "@/features/posts/api";
import { useProjetoAtual } from "@/features/projetos/useProjetoAtual";
import { STATUS_POST } from "@/lib/dominio";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export default function Calendario() {
  const { t } = useTranslation("app");
  const { projetoAtual } = useProjetoAtual();
  const [selecionado, setSelecionado] = useState<PostAgendado | null>(null);

  // Busca só os posts do período visível (o calendário avisa ao trocar de mês)
  const [periodo, setPeriodo] = useState<{ from: string; to: string } | null>(
    null,
  );
  const posts = usePosts(periodo ? projetoAtual?.id : undefined, periodo ?? {});
  const assuntos = useAssuntos(projetoAtual?.id);

  const agendados = useMemo<PostAgendado[]>(() => {
    const nomes = new Map(assuntos.data?.map((a) => [a.id, a.name]));
    return (posts.data ?? [])
      .filter((p) => p.expected_date)
      .map((p) => ({
        id: p.id,
        title: p.title,
        assunto: nomes.get(p.subject_id) ?? "—",
        rede: p.network,
        formato: p.format,
        status: p.status,
        dataPrevista: p.expected_date!,
      }));
  }, [posts.data, assuntos.data]);

  return (
    <>
      <PageMeta
        title={`${t("calendar.title")} | PostPilot`}
        description={t("calendar.metaDescription")}
      />
      <PageHeader
        title={t("calendar.title")}
        subtitle={t("calendar.subtitle")}
        action={
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {STATUS_POST.map((status) => (
              <li
                key={status}
                className="flex items-center gap-1.5 text-theme-xs text-gray-600 dark:text-gray-400"
              >
                <span
                  className={`size-2.5 rounded-full ${NIVEL_COR[STATUS_NIVEL[status]]}`}
                />
                {t(`domain.postStatus.${status}`)}
              </li>
            ))}
          </ul>
        }
      />

      {posts.isError ? (
        <p role="alert" className="text-sm text-error-600">
          {t("posts.loadError")}
        </p>
      ) : (
        // Fica montado enquanto carrega: é o calendário que informa o período
        <div aria-busy={!periodo || posts.isFetching}>
          <PostsCalendar
            posts={agendados}
            onSelect={setSelecionado}
            onRangeChange={setPeriodo}
          />
        </div>
      )}
      <PostDetailsModal
        post={selecionado}
        onClose={() => setSelecionado(null)}
      />
    </>
  );
}
