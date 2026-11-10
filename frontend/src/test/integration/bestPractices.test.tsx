// Integration: read-only guide (/best-practices). No API calls, no project needed.
import BestPractices from "@/pages/BestPractices";
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeApi } from "../fakeApi";
import { renderPage } from "../render";

const render = (route = "/best-practices") =>
  renderPage(<BestPractices />, {
    path: "/best-practices",
    route,
    requireProject: false,
  });

const formats = () =>
  screen.getByRole("region", { name: "Formatos e tamanhos" });

describe("Best practices (/best-practices)", () => {
  it("opens on Instagram with principles, sizes, text limit and hashtags", async () => {
    render();

    expect(
      await screen.findByRole("tab", { name: "Instagram" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Uma ideia por post")).toBeInTheDocument();

    const carousel = within(formats()).getByText("Carrossel").closest("tr")!;
    expect(within(carousel).getByText("1080 × 1350")).toBeInTheDocument();
    expect(within(carousel).getByText("4:5")).toBeInTheDocument();

    // Same limit the post form uses (features/posts/redes.ts)
    expect(screen.getByText("2.200 caracteres")).toBeInTheDocument();
    expect(screen.getByText("3 a 5")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Métricas que importam" }),
    ).toHaveTextContent("Salvamentos");
  });

  it("switches networks through the tabs and the URL", async () => {
    const { user, location } = render();

    await user.click(await screen.findByRole("tab", { name: "LinkedIn" }));
    expect(location()).toBe("/best-practices?network=linkedin");
    expect(screen.getByRole("tab", { name: "LinkedIn" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      within(formats()).getByText("Carrossel (documento PDF)"),
    ).toBeInTheDocument();
    expect(screen.getByText("3.000 caracteres")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "X" }));
    expect(location()).toBe("/best-practices?network=x");
    expect(within(formats()).getByText("Várias imagens")).toBeInTheDocument();
    expect(screen.getByText("280 caracteres")).toBeInTheDocument();
    expect(screen.getByText("1 a 2")).toBeInTheDocument();
  });

  it("opens the tab from a shared link", async () => {
    render("/best-practices?network=x");
    expect(await screen.findByRole("tab", { name: "X" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("falls back to Instagram for an unknown network and calls no API", async () => {
    render("/best-practices?network=tiktok");
    expect(
      await screen.findByRole("tab", { name: "Instagram" }),
    ).toHaveAttribute("aria-selected", "true");
    // Only the project selector (always mounted) talks to the API
    expect(
      fakeApi.requests().filter((r) => !r.url.pathname.endsWith("/projects")),
    ).toEqual([]);
  });
});

describe("Best practices tabs", () => {
  it("are ordered Instagram, LinkedIn, X", async () => {
    render();
    await screen.findByRole("tab", { name: "Instagram" });
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Instagram",
      "LinkedIn",
      "X",
    ]);
  });
});
