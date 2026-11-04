import { ChartAltIcon, CheckCircleIcon, PaperPlaneIcon, PencilIcon } from "@/icons";
import type { StatusPost } from "@/lib/dominio";
import { useFormat } from "@/lib/format";
import type { ComponentType, SVGProps } from "react";
import { useTranslation } from "react-i18next";
import { somar, taxaEngajamento } from "../metrics";
import type { MetricasGrupo } from "../types";

type Card = {
  label: string;
  value: string;
  hint?: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export default function ResumoCards({
  postsPorStatus,
  porRede,
}: {
  postsPorStatus: Record<StatusPost, number>;
  porRede: MetricasGrupo[];
}) {
  const { t } = useTranslation("app", { keyPrefix: "dashboard.cards" });
  const fmt = useFormat();
  const total = somar(porRede);

  const cards: Card[] = [
    {
      label: t("drafts"),
      value: fmt.number(postsPorStatus.draft),
      hint: t("draftsHint"),
      Icon: PencilIcon,
    },
    {
      label: t("approved"),
      value: fmt.number(postsPorStatus.approved),
      hint: t("approvedHint"),
      Icon: CheckCircleIcon,
    },
    {
      label: t("published"),
      value: fmt.number(postsPorStatus.published),
      hint: t("impressions", { count: fmt.number(total.impressoes) }),
      Icon: PaperPlaneIcon,
    },
    {
      label: t("engagementRate"),
      value: fmt.percent(taxaEngajamento(total)),
      hint: t("engagementHint"),
      Icon: ChartAltIcon,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
      {cards.map(({ label, value, hint, Icon }) => (
        <div
          key={label}
          className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 dark:border-gray-800 dark:bg-white/3"
        >
          <div className="flex size-12 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
            <Icon className="size-6 text-gray-800 dark:text-white/90" />
          </div>
          <div className="mt-5">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {label}
            </span>
            <h4 className="mt-2 text-title-sm font-bold text-gray-800 dark:text-white/90">
              {value}
            </h4>
            {hint && (
              <p className="mt-1 text-theme-xs text-gray-400 dark:text-gray-500">
                {hint}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
