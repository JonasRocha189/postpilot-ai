// Integration: the dashboard built from GET /posts, /subjects, /agent/runs and
// /reports/performance (charts replaced by their data, ApexCharts needs a real DOM).
import Dashboard from "@/pages/Dashboard/Dashboard";
import { screen, within } from "@testing-library/react";
import type { ApexOptions } from "apexcharts";
import { describe, expect, it, vi } from "vitest";
import { fakeApi } from "../fakeApi";
import { renderPage } from "../render";

vi.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: () => {} }),
}));

vi.mock("react-apexcharts", () => ({
  default: ({
    type,
    options,
    series,
  }: {
    type: string;
    options: ApexOptions;
    series: { name: string }[];
  }) => (
    <div data-testid={`chart-${type}`}>
      {(options.xaxis?.categories as string[] | undefined)?.join(" | ")}
      {" / "}
      {series.map((s) => s.name).join(" | ")}
    </div>
  ),
}));

function seed() {
  const project = fakeApi.addProject();
  const subject = fakeApi.addSubject(project.id, { name: "Cloud" });
  return { project, subject };
}

describe("Dashboard (/dashboard)", () => {
  it("shows the project's posts, runs and performance", async () => {
    const { project, subject } = seed();
    fakeApi.addPost(subject.id, {
      title: "Migração sem susto",
      variations: [
        { status: "approved", expected_date: "2999-01-10" },
        { network: "x", status: "draft", expected_date: "2999-01-12" },
      ],
    });
    fakeApi.addPost(subject.id, { variations: [{ status: "published" }] });
    fakeApi.addRun(project.id, {
      request: "Temas para a semana",
      mode: "ideation",
    });
    for (let i = 0; i < 5; i++) {
      fakeApi.addPerformance(project.id, { subject: "Cloud" });
    }
    fakeApi.addPerformance(project.id, { network: "x", subject: "Segurança" });

    renderPage(<Dashboard />, { path: "/dashboard" });

    // Cards: variations per status, total impressions and the pooled rate
    expect(await screen.findByText("Rascunhos")).toBeInTheDocument();
    expect(screen.getByText("6.000 impressões")).toBeInTheDocument();
    const rateCard = screen.getByText("Taxa de engajamento").parentElement!;
    expect(within(rateCard).getByText("5,0%")).toBeInTheDocument();

    // Upcoming: the post with both networks, at the nearest date
    const upcoming = screen.getByText("Migração sem susto").closest("li")!;
    expect(
      within(upcoming).getByText("Cloud · LinkedIn, X"),
    ).toBeInTheDocument();
    expect(within(upcoming).getByText(/10 de jan/)).toBeInTheDocument();

    expect(screen.getByText("Temas para a semana")).toBeInTheDocument();

    // Charts and the subject table come from the report
    expect(screen.getByTestId("chart-bar")).toHaveTextContent(
      "LinkedIn (5,0%) | X (5,0%)",
    );
    expect(screen.getByTestId("chart-heatmap")).toHaveTextContent(
      "Noite (18h–24h) | Tarde (12h–18h) | Manhã (6h–12h) | Madrugada (0h–6h)",
    );
    const security = screen.getByText("Segurança").closest("tr")!;
    expect(
      within(security).getByText("Amostra insuficiente"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dados de exemplo")).not.toBeInTheDocument();
  });

  it("invites to import metrics while there is no performance data", async () => {
    seed();

    renderPage(<Dashboard />, { path: "/dashboard" });

    expect(
      await screen.findByRole("link", { name: "Importar métricas" }),
    ).toHaveAttribute("href", "/metrics");
    expect(screen.queryByTestId("chart-bar")).not.toBeInTheDocument();
    expect(screen.getByText("Nenhum post previsto.")).toBeInTheDocument();
    expect(
      screen.getByText("O agente ainda não foi usado."),
    ).toBeInTheDocument();
  });
});
