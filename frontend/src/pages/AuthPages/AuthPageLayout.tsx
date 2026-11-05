import GridShape from "@/components/common/GridShape";
import { LogoMark } from "@/components/common/Logo";
import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";
import LanguageDropdown from "@/components/header/LanguageDropdown";
import React from "react";
import { useTranslation } from "react-i18next";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation("app");

  return (
    <div className="relative z-1 bg-white p-6 sm:p-0 dark:bg-gray-900">
      <div className="relative flex min-h-screen w-full flex-col justify-center sm:p-0 lg:flex-row dark:bg-gray-900">
        {children}
        <div className="hidden min-h-screen w-full items-center bg-brand-950 lg:grid lg:w-1/2 dark:bg-white/5">
          <div className="relative z-1 flex items-center justify-center">
            <GridShape />

            <div className="flex max-w-xs flex-col items-center">
              <LogoMark className="mb-5 size-16" />
              <span className="mb-4 text-4xl font-bold tracking-tight text-white">
                Post<span className="text-brand-400">Pilot</span>
              </span>
              <p className="text-center text-gray-400 dark:text-white/60">
                {t("brand.tagline")}
              </p>
            </div>
          </div>
        </div>

        <div className="fixed inset-e-6 bottom-6 z-50 flex items-center gap-3">
          <LanguageDropdown placement="above" />
          <div className="hidden sm:block">
            <ThemeTogglerTwo />
          </div>
        </div>
      </div>
    </div>
  );
}
