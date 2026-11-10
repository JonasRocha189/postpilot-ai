// Integration: the metrics import page. The CSV is read in the browser, rows
// are matched to published variations of the chosen network and imported in
// one request (POST /metrics/import).
import { templateCsv } from "@/features/metrics/importRows";
import Metrics from "@/pages/Metrics";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw/http";
import { describe, expect, it } from "vitest";
import { API, fakeApi, server } from "../fakeApi";
import { renderPage } from "../render";

const csvFile = (text: string, name = "export.csv") =>
  new File([text], name, { type: "text/csv" });

/** Project with LinkedIn variations published on Nov 2 and 5 (and a draft). */
function seed() {
  const project = fakeApi.addProject();
  const subject = fakeApi.addSubject(project.id);
  const errors = fakeApi.addPost(subject.id, {
    title: "5 erros",
    variations: [
      { network: "linkedin", status: "published", expected_date: "2026-11-02" },
      { network: "x", status: "published", expected_date: "2026-11-02" },
    ],
  });
  const backup = fakeApi.addPost(subject.id, {
    title: "Backup",
    variations: [
      { network: "linkedin", status: "published", expected_date: "2026-11-05" },
    ],
  });
  fakeApi.addPost(subject.id, {
    title: "Ainda rascunho",
    variations: [
      { network: "linkedin", status: "draft", expected_date: "2026-11-05" },
    ],
  });
  return {
    linkedinErrors: errors.variations[0].id,
    xErrors: errors.variations[1].id,
    linkedinBackup: backup.variations[0].id,
  };
}

describe("Metrics import (/metrics)", () => {
  it("reads the LinkedIn CSV, matches rows by date and imports them in one request", async () => {
    const ids = seed();
    const { user } = renderPage(<Metrics />, { path: "/metrics" });

    await user.upload(
      await screen.findByLabelText("Arquivo CSV do LinkedIn"),
      csvFile(templateCsv("linkedin")),
    );

    expect(
      await screen.findByText(
        "export.csv: 2 linhas, 2 prontas para importar, 0 com erro.",
      ),
    ).toBeInTheDocument();
    // Matched by publish date; the draft variation is not offered
    const row2 = screen.getByRole("combobox", {
      name: "Post do PostPilot da linha 2",
    });
    const row3 = screen.getByRole("combobox", {
      name: "Post do PostPilot da linha 3",
    });
    expect(row2).toHaveValue(ids.linkedinErrors);
    expect(row3).toHaveValue(ids.linkedinBackup);
    expect(within(row3).queryByText(/Ainda rascunho/)).not.toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2.720" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Importar 2 linhas" }));

    expect(
      await screen.findByText("2 registros de métricas importados."),
    ).toBeInTheDocument();
    const body = fakeApi.requests("POST", "/metrics/import")[0].body as {
      network: string;
      collected_at: string;
      rows: unknown[];
    };
    expect(body.network).toBe("linkedin");
    expect(body.collected_at).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00Z$/);
    expect(body.rows).toEqual([
      {
        variation_id: ids.linkedinErrors,
        published_at: "2026-11-02T12:00:00Z",
        impressions: 2720,
        likes: 65,
        comments: 13,
        shares: 9,
        clicks: 22,
      },
      expect.objectContaining({
        variation_id: ids.linkedinBackup,
        impressions: 1480,
      }),
    ]);
    // The preview is cleared after importing
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("on X, only X variations are offered; rows can be skipped or fixed by hand", async () => {
    const ids = seed();
    const { user, location } = renderPage(<Metrics />, { path: "/metrics" });

    await user.click(await screen.findByRole("button", { name: "X" }));
    expect(location()).toBe("/metrics?network=x");
    await user.upload(
      screen.getByLabelText("Arquivo CSV do X"),
      csvFile(templateCsv("x")),
    );

    // Nov 2 matches the X variation; Nov 5 has no X post: left for the user
    const row2 = await screen.findByRole("combobox", {
      name: "Post do PostPilot da linha 2",
    });
    const row3 = screen.getByRole("combobox", {
      name: "Post do PostPilot da linha 3",
    });
    expect(row2).toHaveValue(ids.xErrors);
    expect(row3).toHaveValue("");
    expect(within(row3).getAllByRole("option")).toHaveLength(2); // skip + 1 X variation

    await user.click(screen.getByRole("button", { name: "Importar 1 linha" }));
    await screen.findByText("1 registro de métricas importado.");
    expect(
      (
        fakeApi.requests("POST", "/metrics/import")[0].body as {
          rows: unknown[];
        }
      ).rows,
    ).toHaveLength(1);
  });

  it("matches rows even when the posts arrive after the file was read", async () => {
    const ids = seed();
    // Hold GET /posts until the file is uploaded (then fall through to the fake API)
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get(`${API}/posts`, async () => {
        await gate;
      }),
    );
    const { user } = renderPage(<Metrics />, { path: "/metrics" });
    await user.upload(
      await screen.findByLabelText("Arquivo CSV do LinkedIn"),
      csvFile(templateCsv("linkedin")),
    );
    expect(
      await screen.findByText(/2 linhas, 0 prontas para importar/),
    ).toBeInTheDocument();

    release();

    expect(
      await screen.findByText(/2 linhas, 2 prontas para importar/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Post do PostPilot da linha 2" }),
    ).toHaveValue(ids.linkedinErrors);
  });

  it("explains missing columns and invalid rows; nothing is sent", async () => {
    seed();
    const { user } = renderPage(<Metrics />, { path: "/metrics" });
    const input = await screen.findByLabelText("Arquivo CSV do LinkedIn");

    await user.upload(input, csvFile("post,likes\nA,1"));
    expect(
      await screen.findByText(
        "Faltam colunas no arquivo: date, impressions. Baixe o modelo para ver o formato.",
      ),
    ).toBeInTheDocument();

    await user.upload(
      input,
      csvFile("date;impressions\nontem;10\n02/11/2026;1.000"),
    );
    expect(
      await screen.findByText(/2 linhas, 1 prontas para importar, 1 com erro/),
    ).toBeInTheDocument();
    expect(screen.getByText("Data inválida.")).toBeInTheDocument();
    expect(fakeApi.requests("POST", "/metrics/import")).toHaveLength(0);
  });

  it("keeps the preview and shows an error when the API rejects the import", async () => {
    seed();
    server.use(
      http.post(`${API}/metrics/import`, () =>
        HttpResponse.json(
          { detail: "Variation not published" },
          { status: 422 },
        ),
      ),
    );
    const { user } = renderPage(<Metrics />, { path: "/metrics" });
    await user.upload(
      await screen.findByLabelText("Arquivo CSV do LinkedIn"),
      csvFile(templateCsv("linkedin")),
    );
    await user.click(
      await screen.findByRole("button", { name: "Importar 2 linhas" }),
    );

    expect(
      await screen.findByText(
        "Não foi possível importar. Nada foi salvo; tente novamente.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
  });
});
