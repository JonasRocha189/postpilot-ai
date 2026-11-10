import PageHeader from "@/components/common/PageHeader";
import PageMeta from "@/components/common/PageMeta";
import ImageGallery from "@/features/images/components/ImageGallery";
import { useCurrentProject } from "@/features/projects/useCurrentProject";
import { useTranslation } from "react-i18next";

/** /images: the current project's image library, used in posts. */
export default function Images() {
  const { t } = useTranslation("app", { keyPrefix: "images" });
  const { currentProject } = useCurrentProject();

  return (
    <>
      <PageMeta
        title={`${t("title")} | PostPilot`}
        description={t("metaDescription")}
      />
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { project: currentProject?.name })}
      />
      {currentProject && <ImageGallery projectId={currentProject.id} />}
    </>
  );
}
