// Integration: subjects are always scoped by the current project.
import AssuntoFormPage from "@/pages/Assuntos/AssuntoFormPage";
import Assuntos from "@/pages/Assuntos/Assuntos";
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeApi } from "../fakeApi";
import { renderPage } from "../render";

describe("Subjects (/subjects)", () => {
  it("lists only the subjects of the current project", async () => {
    const atual = fakeApi.addProject({ name: "A projeto atual" });
    const outro = fakeApi.addProject({ name: "B outro" });
    fakeApi.addSubject(atual.id, { name: "Cloud" });
    fakeApi.addSubject(outro.id, { name: "Segurança" });

    renderPage(<Assuntos />, { path: "/subjects" });

    expect(
      await screen.findByRole("link", { name: "Cloud" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Segurança")).not.toBeInTheDocument();
    const [request] = fakeApi.requests("GET", "/subjects");
    expect(request.url.searchParams.get("project_id")).toBe(atual.id);
  });

  it("asks to create a project first when there is none", async () => {
    renderPage(<Assuntos />, { path: "/subjects" });
    expect(
      await screen.findByRole("link", { name: "Criar primeiro projeto" }),
    ).toHaveAttribute("href", "/projects/new");
  });

  it("creates a subject in the current project", async () => {
    const atual = fakeApi.addProject();
    const { user, location } = renderPage(<AssuntoFormPage />, {
      path: "/subjects/new",
    });

    await user.type(
      await screen.findByLabelText(/^Nome/),
      "Dicas de segurança",
    );
    await user.click(screen.getByRole("button", { name: "Criar assunto" }));

    await waitFor(() => expect(location()).toBe("/subjects"));
    expect(fakeApi.requests("POST", "/subjects")[0].body).toMatchObject({
      name: "Dicas de segurança",
      project_id: atual.id,
    });
  });

  it("shows the 409 message when the subject still has posts", async () => {
    const project = fakeApi.addProject();
    const subject = fakeApi.addSubject(project.id, { name: "Cloud" });
    fakeApi.addPost(subject.id);
    const { user } = renderPage(<Assuntos />, { path: "/subjects" });

    await user.click(
      await screen.findByRole("button", { name: "Excluir Cloud" }),
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "ainda tem posts",
    );
  });
});
