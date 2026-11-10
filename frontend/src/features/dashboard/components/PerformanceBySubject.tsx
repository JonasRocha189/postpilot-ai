import Badge from "@/components/ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFormat } from "@/lib/format";
import { useTranslation } from "react-i18next";
import { MIN_SAMPLE, enoughSample, engagementRate } from "../metrics";
import type { MetricsGroup } from "../types";
import DashboardCard from "./DashboardCard";

const th =
  "py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400";
const td = "py-3 text-theme-sm text-gray-600 dark:text-gray-400";
// Numeric columns: left padding so they don't stick together on mobile
const num = "ps-4 text-end whitespace-nowrap";

export default function PerformanceBySubject({
  bySubject,
}: {
  bySubject: MetricsGroup[];
}) {
  const { t } = useTranslation("app", { keyPrefix: "dashboard.bySubject" });
  const fmt = useFormat();
  const lines = [...bySubject].sort(
    (a, b) => engagementRate(b) - engagementRate(a),
  );

  return (
    <DashboardCard
      title={t("title")}
      subtitle={t("subtitle", { min: MIN_SAMPLE })}
    >
      <div className="max-w-full overflow-x-auto">
        <Table className="min-w-[28rem]">
          <TableHeader className="border-y border-gray-100 dark:border-gray-800">
            <TableRow>
              <TableCell isHeader className={th}>
                {t("subject")}
              </TableCell>
              <TableCell isHeader className={`${th} ${num}`}>
                {t("posts")}
              </TableCell>
              <TableCell isHeader className={`${th} ${num}`}>
                {t("impressions")}
              </TableCell>
              <TableCell isHeader className={`${th} ${num}`}>
                {t("engagement")}
              </TableCell>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
            {lines.map((line) => (
              <TableRow key={line.group}>
                <TableCell className={`${td} pe-4`}>
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    {line.group}
                  </span>
                  {!enoughSample(line.posts) && (
                    <span className="ms-2 inline-block">
                      <Badge color="warning" size="sm">
                        {t("insufficient")}
                      </Badge>
                    </span>
                  )}
                </TableCell>
                <TableCell className={`${td} ${num}`}>
                  {fmt.number(line.posts)}
                </TableCell>
                <TableCell className={`${td} ${num}`}>
                  {fmt.number(line.impressions)}
                </TableCell>
                <TableCell className={`${td} ${num} font-medium`}>
                  {fmt.percent(engagementRate(line))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </DashboardCard>
  );
}
