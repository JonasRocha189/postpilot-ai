import PageHeader from "@/components/common/PageHeader";
import PageMeta from "@/components/common/PageMeta";
import GaleriaImagens from "@/features/imagens/components/GaleriaImagens";
import { useProjetoAtual } from "@/features/projetos/useProjetoAtual";
import { useTranslation } from "react-i18next";

/** /images: biblioteca de imagens do projeto atual, usada nos posts. */
export default function Imagens() {
  const { t } = useTranslation("app", { keyPrefix: "images" });
  const { projetoAtual } = useProjetoAtual();

  return (
    <>
      <PageMeta
        title={`${t("title")} | PostPilot`}
        description={t("metaDescription")}
      />
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { project: projetoAtual?.name })}
      />
      {projetoAtual && <GaleriaImagens projetoId={projetoAtual.id} />}
    </>
  );
}
