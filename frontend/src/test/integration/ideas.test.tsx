// Integration: the Ideas page (list, filter, create, edit, delete) and a post
// created from an idea (form filled in, then the idea points to the post).
import Ideas from "@/pages/Ideas";
import PostFormPage from "@/pages/Posts/PostFormPage";
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeApi } from "../fakeApi";
import { renderPage } from "../render";

function seed() {
  const project = fakeApi.addProject();
  const subject = fakeApi.addSubject(project.id, { name: "Cloud" });
  return { project, subject };
}

describe("Ideas page (/ideas)", () => {
  it("shows open ideas by default; used ones under “Viraram post”", async () => {
    const { project, subject } = seed();
    const post = fakeApi.addPost(subject.id, { title: "Post pronto" });
    fakeApi.addIdea(project.id, {
      title: "FinOps em 5 passos",
      notes: "Um passo por slide",
      subject_id: subject.id,
      networks: ["linkedin", "instagram"],
      source: "agent",
    });
    fakeApi.addIdea(project.id, { title: "Já usada", post_id: post.id });
    const { user, location } = renderPage(<Ideas />, { path: "/ideas" });

    const card = (await screen.findByText("FinOps em 5 passos")).closest("li")!;
    expect(within(card).getByText("Um passo por slide")).toBeInTheDocument();
    expect(within(card).getByText("Sugerida pelo agente")).toBeInTheDocument();
    expect(within(card).getByText("Cloud")).toBeInTheDocument();
    expect(within(card).getByText("LinkedIn")).toBeInTheDocument();
    expect(
      within(card).getByRole("link", {
        name: "Criar post a partir de FinOps em 5 passos",
      }),
    ).toHaveAttribute("href", expect.stringMatching(/^\/posts\/new\?idea=/));
    expect(screen.queryByText("Já usada")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Viraram post" }));
    expect(location()).toBe("/ideas?show=used");
    const used = screen.getByText("Já usada").closest("li")!;
    expect(within(used).getByText("Virou post")).toBeInTheDocument();
    expect(
      within(used).getByRole("link", { name: "Abrir post" }),
    ).toHaveAttribute("href", `/posts/${post.id}`);
    expect(screen.queryByText("FinOps em 5 passos")).not.toBeInTheDocument();
  });

  it("creates an idea (title required) with subject and networks", async () => {
    const { project, subject } = seed();
    const { user } = renderPage(<Ideas />, { path: "/ideas" });

    await user.click(await screen.findByRole("button", { name: "Nova ideia" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Criar ideia" }),
    );
    expect(
      await within(dialog).findByText("Informe o título da ideia."),
    ).toBeInTheDocument();
    expect(fakeApi.requests("POST", "/ideas")).toHaveLength(0);

    await user.type(
      within(dialog).getByLabelText(/^Título/),
      "Golpes de fim de ano",
    );
    await user.type(
      within(dialog).getByLabelText("Anotações"),
      "Tema de dezembro",
    );
    await user.selectOptions(
      within(dialog).getByLabelText("Assunto"),
      subject.id,
    );
    await user.click(within(dialog).getByRole("checkbox", { name: "X" }));
    await user.click(
      within(dialog).getByRole("checkbox", { name: "Instagram" }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Criar ideia" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    // Networks in the fixed order, whatever the click order
    expect(fakeApi.requests("POST", "/ideas")[0].body).toEqual({
      project_id: project.id,
      title: "Golpes de fim de ano",
      notes: "Tema de dezembro",
      subject_id: subject.id,
      networks: ["instagram", "x"],
    });
    expect(await screen.findByText("Golpes de fim de ano")).toBeInTheDocument();
  });

  it("edits and deletes an idea", async () => {
    const { project } = seed();
    fakeApi.addIdea(project.id, { title: "Rascunho de ideia" });
    const { user } = renderPage(<Ideas />, { path: "/ideas" });

    await user.click(
      await screen.findByRole("button", { name: "Editar Rascunho de ideia" }),
    );
    const dialog = await screen.findByRole("dialog");
    const title = within(dialog).getByLabelText(/^Título/);
    expect(title).toHaveValue("Rascunho de ideia");
    await user.clear(title);
    await user.type(title, "Ideia revisada");
    await user.click(
      within(dialog).getByRole("button", { name: "Salvar ideia" }),
    );
    expect(await screen.findByText("Ideia revisada")).toBeInTheDocument();
    expect(fakeApi.requests("PUT")[0].body).toMatchObject({
      title: "Ideia revisada",
      post_id: null,
    });

    await user.click(
      screen.getByRole("button", { name: "Excluir Ideia revisada" }),
    );
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Excluir",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText("Ideia revisada")).not.toBeInTheDocument(),
    );
    expect(fakeApi.db.ideas).toHaveLength(0);
  });
});

describe("Post from an idea (/posts/new?idea=…)", () => {
  it("fills in title, subject and one variation per network, then links the idea", async () => {
    const { project, subject } = seed();
    const idea = fakeApi.addIdea(project.id, {
      title: "Custos escondidos",
      notes: "Ângulo: PMEs",
      subject_id: subject.id,
      networks: ["x", "linkedin"],
    });
    const { user, location } = renderPage(<PostFormPage />, {
      path: "/posts/new",
      route: `/posts/new?idea=${idea.id}`,
    });

    expect(await screen.findByLabelText(/^Título/)).toHaveValue(
      "Custos escondidos",
    );
    expect(screen.getByLabelText(/^Assunto/)).toHaveValue(subject.id);
    expect(screen.getByRole("checkbox", { name: /^LinkedIn/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /^X/ })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /^Instagram/ }),
    ).not.toBeChecked();

    await user.click(screen.getByRole("button", { name: "Criar post" }));
    await waitFor(() => expect(location()).toBe("/posts"));

    const sent = fakeApi.requests("POST", "/posts")[0].body as {
      variations: { network: string }[];
    };
    expect(sent.variations.map((v) => v.network)).toEqual(["linkedin", "x"]);
    // The idea now points to the new post (and keeps its own fields)
    const created = fakeApi.db.posts[0];
    expect(fakeApi.db.ideas[0]).toMatchObject({
      post_id: created.id,
      notes: "Ângulo: PMEs",
    });
  });
});
