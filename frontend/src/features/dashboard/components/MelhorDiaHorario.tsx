import { useTheme } from "@/context/ThemeContext";
import { useFormat } from "@/lib/format";
import type { ApexOptions } from "apexcharts";
import ReactApexChart from "react-apexcharts";
import { useTranslation } from "react-i18next";
import { AMOSTRA_MINIMA, amostraSuficiente, taxaEngajamento } from "../metrics";
import type { CelulaDiaHorario, FaixaHorario } from "../types";
import DashboardCard from "./DashboardCard";

// De cima para baixo no gráfico
const FAIXAS: {
  faixa: FaixaHorario;
  key: "evening" | "afternoon" | "morning" | "dawn";
}[] = [
  { faixa: "noite", key: "evening" },
  { faixa: "tarde", key: "afternoon" },
  { faixa: "manha", key: "morning" },
  { faixa: "madrugada", key: "dawn" },
];

export default function MelhorDiaHorario({
  celulas,
}: {
  celulas: CelulaDiaHorario[];
}) {
  const { theme } = useTheme();
  const { t } = useTranslation("app");
  const fmt = useFormat();
  const dias = fmt.weekdaysShort();

  const celula = (dia: number, faixa: FaixaHorario) =>
    celulas.find((c) => c.dia === dia && c.faixa === faixa);

  // Uma linha por faixa de horário, uma coluna por dia; valor = taxa em %
  const series = FAIXAS.map(({ faixa, key }) => ({
    name: t(`dashboard.bestTime.${key}`),
    data: dias.map((dia, i) => {
      const c = celula(i, faixa);
      return {
        x: dia,
        y: c ? Number((taxaEngajamento(c) * 100).toFixed(1)) : 0,
      };
    }),
  }));

  const options: ApexOptions = {
    chart: {
      type: "heatmap",
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
      background: "transparent",
    },
    theme: { mode: theme },
    colors: ["#465fff"],
    dataLabels: { enabled: false },
    stroke: { width: 2, colors: [theme === "dark" ? "#101828" : "#ffffff"] },
    plotOptions: { heatmap: { radius: 4, shadeIntensity: 0.6 } },
    tooltip: {
      custom: ({ seriesIndex, dataPointIndex }) => {
        const { faixa, key } = FAIXAS[seriesIndex];
        const c = celula(dataPointIndex, faixa);
        if (!c) return "";
        const aviso = amostraSuficiente(c.posts)
          ? ""
          : `<div style="color:#f79009">${t("dashboard.bestTime.insufficient", { min: AMOSTRA_MINIMA })}</div>`;
        return `<div style="padding:8px 10px;font-size:12px">
          <strong>${dias[dataPointIndex]} · ${t(`dashboard.bestTime.${key}`)}</strong>
          <div>${t("dashboard.bestTime.engagement", { value: fmt.percent(taxaEngajamento(c)) })}</div>
          <div>${t("domain.posts", { count: c.posts })}</div>${aviso}</div>`;
      },
    },
  };

  return (
    <DashboardCard
      title={t("dashboard.bestTime.title")}
      subtitle={t("dashboard.bestTime.subtitle")}
    >
      <ReactApexChart
        options={options}
        series={series}
        type="heatmap"
        height={300}
      />
    </DashboardCard>
  );
}
