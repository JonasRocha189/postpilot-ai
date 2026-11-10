import AuthEntry from "@/components/auth/AuthEntry";
import PageMeta from "@/components/common/PageMeta";
import { useTranslation } from "react-i18next";
import AuthLayout from "./AuthPageLayout";

export default function SignUp() {
  const { t } = useTranslation("app", { keyPrefix: "auth.signup" });

  return (
    <>
      <PageMeta
        title={`${t("metaTitle")} | PostPilot`}
        description={t("metaDescription")}
      />
      <AuthLayout>
        <AuthEntry mode="signup" />
      </AuthLayout>
    </>
  );
}
