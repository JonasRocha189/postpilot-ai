import { useTheme } from "@/context/ThemeContext";
import { NETWORK_LABEL, type Network } from "@/lib/domain";
import { useFormat } from "@/lib/format";
import type { ApexOptions } from "apexcharts";
import ReactApexChart from "react-apexcharts";
import { useTranslation } from "react-i18next";
import { engagementRate } from "../metrics";
import type { MetricsGroup } from "../types";
import DashboardCard from "./DashboardCard";

export default function EngagementByNetwork({
  byNetwork,
}: {
  byNetwork: (MetricsGroup & { group: Network })[];
}) {
  const { theme } = useTheme();
  const { t } = useTranslation("app", { keyPrefix: "dashboard.byNetwork" });
  const fmt = useFormat();

  const options: ApexOptions = {
    chart: {
      type: "bar",
      stacked: true,
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
      background: "transparent",
    },
    theme: { mode: theme },
    colors: ["#465fff", "#9cb9ff", "#12b76a", "#fdb022"],
    plotOptions: {
      bar: { horizontal: false, columnWidth: "45%", borderRadius: 4 },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: byNetwork.map(
        (r) => `${NETWORK_LABEL[r.group]} (${fmt.percent(engagementRate(r))})`,
      ),
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { formatter: (v: number) => fmt.number(v) } },
    legend: { position: "top", horizontalAlign: "left" },
    grid: { borderColor: theme === "dark" ? "#1d2939" : "#e4e7ec" },
    tooltip: { y: { formatter: (v: number) => fmt.number(v) } },
  };

  const series = [
    { name: t("likes"), data: byNetwork.map((r) => r.likes) },
    { name: t("comments"), data: byNetwork.map((r) => r.comments) },
    { name: t("shares"), data: byNetwork.map((r) => r.shares) },
    { name: t("clicks"), data: byNetwork.map((r) => r.clicks) },
  ];

  return (
    <DashboardCard title={t("title")} subtitle={t("subtitle")}>
      <ReactApexChart
        options={options}
        series={series}
        type="bar"
        height={300}
      />
    </DashboardCard>
  );
}
