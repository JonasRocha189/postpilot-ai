import ConfirmDeleteModal from "@/components/common/ConfirmDeleteModal";
import { useTranslation } from "react-i18next";
import { useDeleteProject } from "../api";
import type { Project } from "../types";

export default function DeleteProjectModal({
  project,
  onClose,
}: {
  project: Project | null;
  onClose: () => void;
}) {
  const { t } = useTranslation("app", { keyPrefix: "projects.delete" });
  const remove = useDeleteProject();

  return (
    <ConfirmDeleteModal
      isOpen={project !== null}
      title={t("title", { name: project?.name })}
      message={t("message")}
      conflictMessage={t("hasContent")}
      onConfirm={() => remove.mutateAsync(project!.id)}
      onClose={onClose}
    />
  );
}
