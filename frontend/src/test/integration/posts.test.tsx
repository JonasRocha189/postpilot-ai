// Integration: posts list (filters in the URL and in the API query) and the
// post form, master-detail: the post and one variation per network (tabs),
// each with format, text editor, calendar date, status and ordered images.
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
  it("shows each post with its variations: network, format, local date and status", async () => {
    const { subject } = seed();
    const post = fakeApi.addPost(subject.id, {
      title: "Backup em nuvem",
      variations: [
        {
          network: "linkedin",
          status: "published",
          expected_date: "2026-11-18",
        },
        {
          network: "instagram",
          format: "carousel",
          status: "review",
          expected_date: "2026-11-20",
        },
      ],
    });

    renderPage(<Posts />, { path: "/posts" });

    const row = (
      await screen.findByRole("link", { name: "Backup em nuvem" })
    ).closest("tr")!;
    expect(within(row).getAllByText("Cloud").length).toBeGreaterThan(0);
    // Date-only values are shown as the same local day (not the day before)
    const instagram = within(row).getAllByRole("link", {
      name: /^Instagram · Carrossel · 20 de nov/,
    });
    expect(instagram[0]).toHaveAttribute(
      "href",
      `/posts/${post.id}?network=instagram`,
    );
    expect(
      within(row).getAllByRole("link", {
        name: /^LinkedIn · Só texto · 18 de nov/,
      }).length,
    ).toBeGreaterThan(0);
    expect(within(row).getAllByText("Em revisão").length).toBeGreaterThan(0);
    expect(within(row).getAllByText("Publicado").length).toBeGreaterThan(0);
  });

  it("filters by network: a post shows up when one of its variations matches", async () => {
    const { project, subject } = seed();
    fakeApi.addPost(subject.id, {
      title: "Só LinkedIn",
      variations: [{ network: "linkedin" }],
    });
    fakeApi.addPost(subject.id, {
      title: "LinkedIn e X",
      variations: [{ network: "linkedin" }, { network: "x" }],
    });
    const { user, location } = renderPage(<Posts />, { path: "/posts" });

    await screen.findByRole("link", { name: "Só LinkedIn" });
    await user.selectOptions(screen.getByLabelText("Rede"), "x");

    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: "Só LinkedIn" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("link", { name: "LinkedIn e X" }),
    ).toBeInTheDocument();
    expect(location()).toBe("/posts?network=x");
    const last = fakeApi.requests("GET", "/posts").at(-1)!;
    expect(Object.fromEntries(last.url.searchParams)).toEqual({
      project_id: project.id,
      network: "x",
    });
  });

  it("filters by status through the URL and the API query", async () => {
    const { project, subject } = seed();
    fakeApi.addPost(subject.id, {
      title: "Rascunho A",
      variations: [{ status: "draft" }],
    });
    fakeApi.addPost(subject.id, {
      title: "Para revisar",
      variations: [{ status: "review" }],
    });
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

    // A new post starts with an Instagram variation (tab) and its format
    expect(screen.getByRole("checkbox", { name: /^Instagram/ })).toBeChecked();
    expect(screen.getByRole("tab", { name: /^Instagram/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
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
      variations: [
        {
          network: "instagram",
          format: "carousel",
          status: "review",
          expected_date: "2026-11-20",
          content: "• Dica do dia🚀",
          image_ids: [a.id, b.id],
        },
      ],
    });
  });

  it("master-detail: one post with LinkedIn and X variations, each with its own text, status and date", async () => {
    const { subject } = seed();
    const { user, location } = renderPage(<PostFormPage />, {
      path: "/posts/new",
    });
    await user.type(await screen.findByLabelText(/^Título/), "Custos da nuvem");
    await user.selectOptions(screen.getByLabelText(/^Assunto/), subject.id);

    // Add LinkedIn: its tab opens; then remove Instagram
    await user.click(screen.getByRole("checkbox", { name: /^LinkedIn/ }));
    expect(screen.getByRole("tab", { name: /^LinkedIn/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.click(screen.getByRole("checkbox", { name: /^Instagram/ }));
    expect(
      screen.queryByRole("tab", { name: /^Instagram/ }),
    ).not.toBeInTheDocument();
    // The last network cannot be unchecked
    expect(screen.getByRole("checkbox", { name: /^LinkedIn/ })).toBeDisabled();

    await user.type(
      screen.getByLabelText("Conteúdo"),
      "Texto longo para o LinkedIn",
    );
    await user.selectOptions(screen.getByLabelText(/^Status/), "approved");
    await user.type(screen.getByLabelText("Data prevista"), "20/11/2026");
    await user.tab();

    // X: its own tab, text, status and date
    await user.click(screen.getByRole("checkbox", { name: /^X/ }));
    expect(screen.getByLabelText("Conteúdo")).toHaveValue("");
    expect(screen.getByLabelText(/^Status/)).toHaveValue("draft");
    await user.type(screen.getByLabelText("Conteúdo"), "Versão curta");
    await user.type(screen.getByLabelText("Data prevista"), "21/11/2026");
    await user.tab();

    // Back on LinkedIn, its values are still there; the tab shows the status
    const linkedinTab = screen.getByRole("tab", { name: /^LinkedIn/ });
    expect(linkedinTab).toHaveTextContent("Aprovado");
    await user.click(linkedinTab);
    expect(screen.getByLabelText("Conteúdo")).toHaveValue(
      "Texto longo para o LinkedIn",
    );

    await user.click(screen.getByRole("button", { name: "Criar post" }));
    await waitFor(() => expect(location()).toBe("/posts"));
    expect(fakeApi.requests("POST", "/posts")[0].body).toEqual({
      title: "Custos da nuvem",
      subject_id: subject.id,
      variations: [
        {
          network: "linkedin",
          format: "text",
          status: "approved",
          expected_date: "2026-11-20",
          content: "Texto longo para o LinkedIn",
          image_ids: [],
        },
        {
          network: "x",
          format: "text",
          status: "draft",
          expected_date: "2026-11-21",
          content: "Versão curta",
          image_ids: [],
        },
      ],
    });
  });

  it("an invalid variation marks its tab and opens it on submit", async () => {
    const { subject } = seed();
    const { user } = renderPage(<PostFormPage />, { path: "/posts/new" });
    await user.type(await screen.findByLabelText(/^Título/), "Fio");
    await user.selectOptions(screen.getByLabelText(/^Assunto/), subject.id);

    // X with too much text, then go back to the (valid) Instagram tab
    await user.click(screen.getByRole("checkbox", { name: /^X/ }));
    await user.click(screen.getByRole("radio", { name: /^Só texto/ }));
    await user.click(screen.getByLabelText("Conteúdo"));
    await user.paste("a".repeat(281));
    await user.click(screen.getByRole("tab", { name: /^Instagram/ }));

    await user.click(screen.getByRole("button", { name: "Criar post" }));

    const xTab = screen.getByRole("tab", { name: /^X/ });
    await waitFor(() => expect(xTab).toHaveAttribute("aria-selected", "true"));
    expect(xTab).toHaveTextContent("Esta variação tem erros");
    expect(
      screen.getByText(
        "Passou do limite de 280 caracteres do X (contando as hashtags).",
      ),
    ).toBeInTheDocument();
    expect(fakeApi.requests("POST", "/posts")).toHaveLength(0);
  });

  it("unchecking a network and checking it again brings its text back", async () => {
    seed();
    const { user } = renderPage(<PostFormPage />, { path: "/posts/new" });
    await user.click(
      await screen.findByRole("checkbox", { name: /^LinkedIn/ }),
    );
    await user.type(screen.getByLabelText("Conteúdo"), "Rascunho do LinkedIn");

    await user.click(screen.getByRole("checkbox", { name: /^LinkedIn/ }));
    expect(
      screen.queryByRole("tab", { name: /^LinkedIn/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /^LinkedIn/ }));

    expect(screen.getByLabelText("Conteúdo")).toHaveValue(
      "Rascunho do LinkedIn",
    );
  });

  it("on X, offers text only and enforces the 280-character limit", async () => {
    const { subject } = seed();
    const { user } = renderPage(<PostFormPage />, { path: "/posts/new" });

    await user.type(await screen.findByLabelText(/^Título/), "Fio");
    await user.selectOptions(screen.getByLabelText(/^Assunto/), subject.id);
    await user.click(screen.getByRole("checkbox", { name: /^X/ }));
    await user.click(screen.getByRole("checkbox", { name: /^Instagram/ }));
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
      variations: [
        { network: "linkedin", content: "Texto do LinkedIn" },
        {
          network: "instagram",
          format: "single",
          expected_date: "2026-11-20",
          image_ids: [image.id],
        },
      ],
    });
    const [linkedinId, instagramId] = post.variations.map((v) => v.id);
    // ?network= opens that variation's tab (links from the list and the calendar)
    const { user, location } = renderPage(<PostFormPage />, {
      path: "/posts/:id",
      route: `/posts/${post.id}?network=instagram`,
    });

    expect(await screen.findByDisplayValue("Com imagem")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^Instagram/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("Data prevista")).toHaveValue("20/11/2026");
    await user.click(screen.getByRole("button", { name: "Limpar data" }));
    expect(screen.getByLabelText("Data prevista")).toHaveValue("");
    await user.click(
      await screen.findByRole("button", { name: "Remover imagem 1" }),
    );
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(location()).toBe("/posts"));
    const body = fakeApi.requests("PUT")[0].body as {
      variations: { network: string }[];
    };
    expect(body.variations).toEqual([
      expect.objectContaining({
        network: "linkedin",
        content: "Texto do LinkedIn",
      }),
      expect.objectContaining({
        network: "instagram",
        expected_date: null,
        image_ids: [],
      }),
    ]);
    // The API keeps each network's variation id (metrics hang on it)
    expect(fakeApi.db.posts[0].variations.map((v) => v.id)).toEqual([
      linkedinId,
      instagramId,
    ]);
  });
});
