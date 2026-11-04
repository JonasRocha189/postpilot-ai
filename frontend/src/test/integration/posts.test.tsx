// Integration: posts list (filters in the URL and in the API query) and the
// post form: network, format, text editor, calendar date and ordered images.
import PostFormPage from "@/pages/Posts/PostFormPage";
import Posts from "@/pages/Posts/Posts";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw/http";
import { describe, expect, it } from "vitest";
import { API, fakeApi, server } from "../fakeApi";
import { renderPage } from "../render";

function seed() {
  const project = fakeApi.addProject();
  const subject = fakeApi.addSubject(project.id, { name: "Cloud" });
  return { project, subject };
}

describe("Posts list (/posts)", () => {
  it("shows the posts with subject, network, local date and status", async () => {
    const { subject } = seed();
    fakeApi.addPost(subject.id, {
      title: "Backup em nuvem",
      status: "review",
      network: "instagram",
      format: "carousel",
      expected_date: "2026-11-20",
    });

    renderPage(<Posts />, { path: "/posts" });

    const row = (
      await screen.findByRole("link", { name: "Backup em nuvem" })
    ).closest("tr")!;
    expect(within(row).getByText("Em revisão")).toBeInTheDocument();
    expect(within(row).getAllByText("Cloud").length).toBeGreaterThan(0);
    expect(
      within(row).getAllByText("Instagram · Carrossel").length,
    ).toBeGreaterThan(0);
    // Date-only value is shown as the same local day (not the day before)
    expect(within(row).getAllByText(/20 de nov/).length).toBeGreaterThan(0);
  });

  it("filters by status through the URL and the API query", async () => {
    const { project, subject } = seed();
    fakeApi.addPost(subject.id, { title: "Rascunho A", status: "draft" });
    fakeApi.addPost(subject.id, { title: "Para revisar", status: "review" });
    const { user, location } = renderPage(<Posts />, { path: "/posts" });

    await screen.findByRole("link", { name: "Rascunho A" });
    await user.selectOptions(screen.getByLabelText("Status"), "review");

    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: "Rascunho A" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("link", { name: "Para revisar" }),
    ).toBeInTheDocument();
    expect(location()).toBe("/posts?status=review");
    const last = fakeApi.requests("GET", "/posts").at(-1)!;
    expect(Object.fromEntries(last.url.searchParams)).toEqual({
      project_id: project.id,
      status: "review",
    });
  });

  it("asks for a subject before the first post", async () => {
    fakeApi.addProject();
    renderPage(<Posts />, { path: "/posts" });
    expect(
      await screen.findByText("Crie um assunto primeiro"),
    ).toBeInTheDocument();
  });
});

describe("Post form (/posts/new)", () => {
  it("creates an Instagram carousel: calendar date, editor toolbar and ordered images", async () => {
    const { project, subject } = seed();
    const a = fakeApi.addImage(project.id, { description: "Imagem A" });
    const b = fakeApi.addImage(project.id, { description: "Imagem B" });
    const { user, location } = renderPage(<PostFormPage />, {
      path: "/posts/new",
    });

    await user.type(await screen.findByLabelText(/^Título/), "Checklist");
    await user.selectOptions(screen.getByLabelText(/^Assunto/), subject.id);
    await user.selectOptions(screen.getByLabelText(/^Status/), "review");

    // Date shown as dd/mm/aaaa, sent as AAAA-MM-DD
    const data = screen.getByLabelText("Data prevista");
    expect(data).toHaveAttribute("placeholder", "dd/mm/aaaa");
    await user.type(data, "20/11/2026");
    await user.tab();
    expect(data).toHaveValue("20/11/2026");

    // Network (Instagram by default) and format
    expect(screen.getByRole("radio", { name: /^Instagram/ })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: /^Carrossel/ }));

    // Editor: bullet at the start of the line and an emoji at the cursor
    const editor = screen.getByLabelText("Conteúdo");
    await user.type(editor, "Dica do dia");
    await user.click(screen.getByRole("button", { name: /Inserir marcador/ }));
    await user.click(screen.getByRole("button", { name: "Inserir emoji" }));
    await user.click(screen.getByRole("button", { name: "Inserir 🚀" }));
    expect(editor).toHaveValue("• Dica do dia🚀");
    expect(screen.getByText("14 / 2.200 caracteres")).toBeInTheDocument();

    // Pick B then A in the library, then move A to the front
    await user.click(screen.getByRole("button", { name: "Escolher" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      await within(dialog).findByRole("button", { name: "Imagem B" }),
    );
    await user.click(within(dialog).getByRole("button", { name: "Imagem A" }));
    await user.click(
      within(dialog).getByRole("button", { name: "Concluir (2)" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("2 de 20")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Mover imagem 2 para a esquerda" }),
    );

    await user.click(screen.getByRole("button", { name: "Criar post" }));

    await waitFor(() => expect(location()).toBe("/posts"));
    expect(fakeApi.requests("POST", "/posts")[0].body).toEqual({
      title: "Checklist",
      subject_id: subject.id,
      status: "review",
      network: "instagram",
      format: "carousel",
      expected_date: "2026-11-20",
      content: "• Dica do dia🚀",
      image_ids: [a.id, b.id],
    });
  });

  it("on X, offers text only and enforces the 280-character limit", async () => {
    const { subject } = seed();
    const { user } = renderPage(<PostFormPage />, { path: "/posts/new" });

    await user.type(await screen.findByLabelText(/^Título/), "Fio");
    await user.selectOptions(screen.getByLabelText(/^Assunto/), subject.id);
    await user.click(screen.getByRole("radio", { name: /^X/ }));
    expect(
      screen.getByRole("radio", { name: /^Várias imagens/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /^Só texto/ }));

    // Text only: no image picker
    expect(
      screen.queryByRole("button", { name: "Escolher" }),
    ).not.toBeInTheDocument();
    const editor = screen.getByLabelText("Conteúdo");
    await user.click(editor);
    await user.paste("a".repeat(281));
    expect(screen.getByText("281 / 280 caracteres")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Criar post" }));
    expect(
      await screen.findByText(
        "Passou do limite de 280 caracteres do X (contando as hashtags).",
      ),
    ).toBeInTheDocument();
    expect(fakeApi.requests("POST", "/posts")).toHaveLength(0);
  });

  it("previews the post cut where the network shows “see more”", async () => {
    seed();
    const { user } = renderPage(<PostFormPage />, { path: "/posts/new" });
    const editor = await screen.findByLabelText("Conteúdo");
    await user.click(editor);
    await user.paste(`${"a".repeat(125)}FIM`);

    await user.click(screen.getByRole("tab", { name: "Pré-visualizar" }));
    expect(
      screen.getByText("Como aparece no feed do Instagram"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/FIM/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "mais" }));
    expect(screen.getByText(/FIM/)).toBeInTheDocument();
  });

  it("validates title and subject without calling the API", async () => {
    seed();
    const { user } = renderPage(<PostFormPage />, { path: "/posts/new" });

    await user.click(await screen.findByRole("button", { name: "Criar post" }));

    expect(
      await screen.findByText("Informe o título do post."),
    ).toBeInTheDocument();
    expect(screen.getByText("Selecione o assunto.")).toBeInTheDocument();
    expect(fakeApi.requests("POST", "/posts")).toHaveLength(0);
  });

  it("asks for the image before approving a single-image post", async () => {
    const { subject } = seed();
    const { user } = renderPage(<PostFormPage />, { path: "/posts/new" });

    await user.type(await screen.findByLabelText(/^Título/), "Post");
    await user.selectOptions(screen.getByLabelText(/^Assunto/), subject.id);
    await user.selectOptions(screen.getByLabelText(/^Status/), "approved");
    await user.click(screen.getByRole("button", { name: "Criar post" }));

    expect(
      await screen.findByText(
        "Posts aprovados ou publicados precisam de uma imagem.",
      ),
    ).toBeInTheDocument();
    expect(fakeApi.requests("POST", "/posts")).toHaveLength(0);
  });

  it("shows an error when the API rejects the post", async () => {
    const { subject } = seed();
    server.use(
      http.post(`${API}/posts`, () =>
        HttpResponse.json(
          { detail: "Image is not in this project's library" },
          { status: 422 },
        ),
      ),
    );
    const { user, location } = renderPage(<PostFormPage />, {
      path: "/posts/new",
    });

    await user.type(await screen.findByLabelText(/^Título/), "Post");
    await user.selectOptions(screen.getByLabelText(/^Assunto/), subject.id);
    await user.click(screen.getByRole("button", { name: "Criar post" }));

    expect(
      await screen.findByText(
        "Não foi possível salvar o post. Tente novamente.",
      ),
    ).toBeInTheDocument();
    expect(location()).toBe("/posts/new");
  });

  it("edits a post: loads the date, clears it and removes the image", async () => {
    const { project, subject } = seed();
    const image = fakeApi.addImage(project.id, { description: "Nuvem" });
    const post = fakeApi.addPost(subject.id, {
      title: "Com imagem",
      network: "instagram",
      format: "single",
      expected_date: "2026-11-20",
      image_ids: [image.id],
    });
    const { user, location } = renderPage(<PostFormPage />, {
      path: "/posts/:id",
      route: `/posts/${post.id}`,
    });

    expect(await screen.findByDisplayValue("Com imagem")).toBeInTheDocument();
    expect(screen.getByLabelText("Data prevista")).toHaveValue("20/11/2026");
    await user.click(screen.getByRole("button", { name: "Limpar data" }));
    expect(screen.getByLabelText("Data prevista")).toHaveValue("");
    await user.click(
      await screen.findByRole("button", { name: "Remover imagem 1" }),
    );
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(location()).toBe("/posts"));
    expect(fakeApi.requests("PUT")[0].body).toMatchObject({
      expected_date: null,
      image_ids: [],
    });
  });
});
