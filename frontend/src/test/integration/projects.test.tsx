// Integration: projects pages + TanStack Query + http service, against the fake API (MSW).
import ProjectFormPage from "@/pages/Projects/ProjectFormPage";
import Projects from "@/pages/Projects/Projects";
import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fakeApi } from "../fakeApi";
import { renderPage } from "../render";

describe("Projects page (/projects)", () => {
  it("lists the user's projects from the API, marking the current one", async () => {
    fakeApi.addProject({ name: "Acme Cloud" });
    fakeApi.addProject({ name: "Minha marca" });

    renderPage(<Projects />, { path: "/projects", requireProject: false });

    expect(
      await screen.findByRole("heading", { name: "Acme Cloud" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Minha marca" }),
    ).toBeInTheDocument();
    // First project (by name) is the current one when nothing was chosen yet
    expect(screen.getByText("Projeto em uso")).toBeInTheDocument();
    expect(fakeApi.requests("GET", "/projects")).not.toHaveLength(0);
  });

  it("shows the conflict message when the API refuses to delete (409)", async () => {
    const project = fakeApi.addProject({ name: "Acme Cloud" });
    fakeApi.addSubject(project.id);
    const { user } = renderPage(<Projects />, {
      path: "/projects",
      requireProject: false,
    });

    await user.click(
      await screen.findByRole("button", { name: "Excluir Acme Cloud" }),
    );
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "ainda tem assuntos, documentos ou imagens",
    );
    expect(fakeApi.db.projects).toHaveLength(1);
  });

  it("deletes an empty project and refreshes the list", async () => {
    fakeApi.addProject({ name: "Acme Cloud" });
    fakeApi.addProject({ name: "Minha marca" });
    const { user } = renderPage(<Projects />, {
      path: "/projects",
      requireProject: false,
    });

    await user.click(
      await screen.findByRole("button", { name: "Excluir Minha marca" }),
    );
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Excluir",
      }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Minha marca" }),
      ).not.toBeInTheDocument(),
    );
    expect(fakeApi.requests("DELETE")).toHaveLength(1);
  });
});

describe("New project form (/projects/new)", () => {
  it("validates the name before calling the API", async () => {
    const { user } = renderPage(<ProjectFormPage />, {
      path: "/projects/new",
      requireProject: false,
    });

    await user.click(
      await screen.findByRole("button", { name: "Criar projeto" }),
    );

    expect(
      await screen.findByText("Informe o nome do projeto."),
    ).toBeInTheDocument();
    expect(fakeApi.requests("POST", "/projects")).toHaveLength(0);
  });

  it("creates the project (empty fields as null) and goes back to the list", async () => {
    const { user, location } = renderPage(<ProjectFormPage />, {
      path: "/projects/new",
      requireProject: false,
    });

    await user.type(await screen.findByLabelText(/^Nome/), "  Acme Cloud ");
    await user.type(screen.getByLabelText("Tom de voz"), "Direto");
    await user.click(screen.getByRole("button", { name: "Criar projeto" }));

    await waitFor(() => expect(location()).toBe("/projects"));
    const [post] = fakeApi.requests("POST", "/projects");
    expect(post.body).toMatchObject({
      name: "Acme Cloud",
      voice_tone: "Direto",
      description: null,
      target_audience: null,
    });
    // The new project becomes the current one
    expect(localStorage.getItem("postpilot:projeto-atual")).toBe(
      fakeApi.db.projects[0].id,
    );
  });
});
