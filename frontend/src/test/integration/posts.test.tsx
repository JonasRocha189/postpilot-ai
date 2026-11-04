// Integration: posts list (filters in the URL and in the API query) and the
// post form with the image picker (library of the current project).
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
  it("shows the posts with subject, local date and status", async () => {
    const { subject } = seed();
    fakeApi.addPost(subject.id, {
      title: "Backup em nuvem",
      status: "review",
      expected_date: "2026-11-20",
    });

    renderPage(<Posts />, { path: "/posts" });

    const row = (
      await screen.findByRole("link", { name: "Backup em nuvem" })
    ).closest("tr")!;
    expect(within(row).getByText("Em revisão")).toBeInTheDocument();
    expect(within(row).getAllByText("Cloud").length).toBeGreaterThan(0);
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
  it("creates a post with an image chosen from the project's library", async () => {
    const { project, subject } = seed();
    const image = fakeApi.addImage(project.id, {
      description: "Checklist de segurança",
    });
    const { user, location } = renderPage(<PostFormPage />, {
      path: "/posts/new",
    });

    await user.type(
      await screen.findByLabelText(/^Título/),
      "Checklist de fim de ano",
    );
    await user.selectOptions(screen.getByLabelText(/^Assunto/), subject.id);
    await user.selectOptions(screen.getByLabelText(/^Status/), "review");
    await user.type(screen.getByLabelText("Data prevista"), "2026-11-20");
    await user.type(screen.getByLabelText("Conteúdo"), "Texto do post");

    await user.click(
      screen.getByRole("button", { name: "Escolher da biblioteca" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(
      await within(dialog).findByRole("button", {
        name: "Checklist de segurança",
      }),
    );
    // Picker closes and shows the chosen image
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Trocar imagem" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Criar post" }));

    await waitFor(() => expect(location()).toBe("/posts"));
    expect(fakeApi.requests("POST", "/posts")[0].body).toEqual({
      title: "Checklist de fim de ano",
      subject_id: subject.id,
      status: "review",
      expected_date: "2026-11-20",
      content: "Texto do post",
      image_id: image.id,
    });
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

  it("edits a post and removes its image (image_id: null)", async () => {
    const { project, subject } = seed();
    const image = fakeApi.addImage(project.id, { description: "Nuvem" });
    const post = fakeApi.addPost(subject.id, {
      title: "Com imagem",
      image_id: image.id,
    });
    const { user, location } = renderPage(<PostFormPage />, {
      path: "/posts/:id",
      route: `/posts/${post.id}`,
    });

    expect(await screen.findByDisplayValue("Com imagem")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Remover" }));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(location()).toBe("/posts"));
    expect(fakeApi.requests("PUT")[0].body).toMatchObject({ image_id: null });
  });
});
