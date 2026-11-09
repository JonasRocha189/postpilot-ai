// Integration: the header badge with the backend's health (GET /health/ready).
import HealthStatus from "@/features/health/components/HealthStatus";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw/http";
import { describe, expect, it } from "vitest";
import { API, server } from "../fakeApi";

function renderBadge() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <HealthStatus />
    </QueryClientProvider>,
  );
}

describe("Health badge (header)", () => {
  it("shows Online and the details when the API and the database answer", async () => {
    const user = userEvent.setup();
    renderBadge();

    const badge = await screen.findByRole("button", {
      name: "Saúde do sistema: Tudo funcionando",
    });
    expect(badge).toHaveTextContent("Online");

    await user.click(badge);
    expect(screen.getByText("Respondendo")).toBeInTheDocument();
    expect(screen.getByText(/\d+ ms/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Verificar agora" }),
    ).toBeEnabled();
  });

  it("warns when the database is down (503)", async () => {
    server.use(
      http.get(`${API}/health/ready`, () =>
        HttpResponse.json(
          { status: "unavailable", checks: { database: "error" } },
          { status: 503 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderBadge();

    const badge = await screen.findByRole("button", {
      name: "Saúde do sistema: API no ar, banco de dados indisponível",
    });
    expect(badge).toHaveTextContent("Instável");
    await user.click(badge);
    expect(screen.getByText("Indisponível")).toBeInTheDocument();
  });

  it("shows Offline when the server doesn't answer, and checks again on demand", async () => {
    let calls = 0;
    server.use(
      http.get(`${API}/health/ready`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.error()
          : HttpResponse.json({ status: "ok", checks: { database: "ok" } });
      }),
    );
    const user = userEvent.setup();
    renderBadge();

    const offline = await screen.findByRole("button", {
      name: "Saúde do sistema: Servidor sem resposta",
    });
    await user.click(offline);
    expect(screen.getByText("Sem resposta")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Verificar agora" }));

    expect(
      await screen.findByRole("button", {
        name: "Saúde do sistema: Tudo funcionando",
      }),
    ).toBeInTheDocument();
  });
});
