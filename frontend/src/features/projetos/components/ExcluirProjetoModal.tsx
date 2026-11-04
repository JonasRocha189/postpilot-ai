import ConfirmarExclusaoModal from "@/components/common/ConfirmarExclusaoModal";
import { useTranslation } from "react-i18next";
import { useExcluirProjeto } from "../api";
import type { Projeto } from "../types";

export default function ExcluirProjetoModal({
  projeto,
  onClose,
}: {
  projeto: Projeto | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("app", { keyPrefix: "projects.delete" });
  const excluir = useExcluirProjeto();

  return (
    <ConfirmarExclusaoModal
      isOpen={projeto !== null}
      title={t("title", { name: projeto?.name })}
      message={t("message")}
      conflictMessage={t("hasContent")}
      onConfirm={() => excluir.mutateAsync(projeto!.id)}
      onClose={onClose}
    />
  );
}
