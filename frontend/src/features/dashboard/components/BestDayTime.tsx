import { useTheme } from "@/context/ThemeContext";
import { useFormat } from "@/lib/format";
import type { ApexOptions } from "apexcharts";
import ReactApexChart from "react-apexcharts";
import { useTranslation } from "react-i18next";
import { MIN_SAMPLE, enoughSample, engagementRate } from "../metrics";
import type { DayTimeCell, TimeBand } from "../types";
import DashboardCard from "./DashboardCard";

// Top to bottom in the chart
const BANDS: {
  band: TimeBand;
  key: "evening" | "afternoon" | "morning" | "dawn";
}[] = [
  { band: "noite", key: "evening" },
  { band: "tarde", key: "afternoon" },
  { band: "manha", key: "morning" },
  { band: "madrugada", key: "dawn" },
];

export default function BestDayTime({ cells }: { cells: DayTimeCell[] }) {
  const { theme } = useTheme();
  const { t } = useTranslation("app");
  const fmt = useFormat();
  const days = fmt.weekdaysShort();

  const cell = (day: number, band: TimeBand) =>
    cells.find((c) => c.day === day && c.band === band);

  // One row per time band, one column per day; value = rate in %
  const series = BANDS.map(({ band, key }) => ({
    name: t(`dashboard.bestTime.${key}`),
    data: days.map((day, i) => {
      const c = cell(i, band);
      return {
        x: day,
        y: c ? Number((engagementRate(c) * 100).toFixed(1)) : 0,
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
        const { band, key } = BANDS[seriesIndex];
        const c = cell(dataPointIndex, band);
        if (!c) return "";
        const warning = enoughSample(c.posts)
          ? ""
          : `<div style="color:#f79009">${t("dashboard.bestTime.insufficient", { min: MIN_SAMPLE })}</div>`;
        return `<div style="padding:8px 10px;font-size:12px">
          <strong>${days[dataPointIndex]} · ${t(`dashboard.bestTime.${key}`)}</strong>
          <div>${t("dashboard.bestTime.engagement", { value: fmt.percent(engagementRate(c)) })}</div>
          <div>${t("domain.posts", { count: c.posts })}</div>${warning}</div>`;
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
