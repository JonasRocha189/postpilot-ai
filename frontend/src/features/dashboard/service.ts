import { apiFetch, apiMode } from "@/lib/api/http";
import { reportsMock } from "./mock";
import type { PerformanceReport } from "./types";

export interface ReportsService {
  /** The project's published variations with their latest metrics */
  performance(projectId: string): Promise<PerformanceReport>;
}

const reportsHttp: ReportsService = {
  performance: (projectId) =>
    apiFetch<PerformanceReport>(
      `/reports/performance?${new URLSearchParams({ project_id: projectId })}`,
    ),
};

export const reportsService: ReportsService =
  apiMode === "mock" ? reportsMock : reportsHttp;
