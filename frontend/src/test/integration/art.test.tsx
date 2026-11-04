// Integration: the artwork editor in the post form. jsdom has no canvas, so
// the drawing module is replaced; the size, the choices, the upload to the
// library (presigned URL + S3 + POST /images) and the post body are real.
import PostFormPage from "@/pages/Posts/PostFormPage";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi } from "../fakeApi";
import { renderPage } from "../render";

const canvas = vi.hoisted(() => ({
  desenharArte: vi.fn(),
  baixarArquivos: vi.fn<
    (arquivos: { arquivo: File; nome: string }[]) => Promise<void>
  >(() => Promise.resolve()),
  carregarFonte: vi.fn(() => Promise.resolve()),
  carregarImagem: vi.fn<
    (
      url: string,
    ) => Promise<{ width: number; height: number; close: () => void }>
  >(() => Promise.resolve({ width: 2000, height: 1000, close: () => {} })),
  exportarSlide: vi.fn<
    (arte: { imagem: unknown }, fundo: unknown) => Promise<File>
  >((arte) =>
    Promise.resolve(
      new File(["arte"], arte.imagem ? "arte.jpg" : "arte.png", {
        type: arte.imagem ? "image/jpeg" : "image/png",
      }),
    ),
  ),
}));
vi.mock("@/features/arte/canvas", () => canvas);

beforeEach(() => vi.clearAllMocks());

function seed() {
  const project = fakeApi.addProject();
  const subject = fakeApi.addSubject(project.id, { name: "Cloud" });
  return { project, subject };
}

async function abrirEditor(titulo: string, subjectId: string) {
  const r = renderPage(<PostFormPage />, { path: "/posts/new" });
  await r.user.type(await screen.findByLabelText(/^Título/), titulo);
  await r.user.selectOptions(screen.getByLabelText(/^Assunto/), subjectId);
  return r;
}

describe("Artwork editor (post form, single image)", () => {
  it("creates a color + text artwork, saves it to the library and uses it in the post", async () => {
    const { project, subject } = seed();
    const { user, location } = await abrirEditor("Checklist", subject.id);

    await user.click(screen.getByRole("button", { name: "Criar arte" }));
    const dialog = await screen.findByRole("dialog");

    // Instagram single image: 1080 × 1350 (4:5) by default
    expect(
      within(dialog).getByRole("img", {
        name: "Prévia da arte (1080 × 1350 px)",
      }),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("radio", { name: "1080 × 1080 · 1:1" }),
    );
    expect(
      within(dialog).getByRole("img", {
        name: "Prévia da arte (1080 × 1080 px)",
      }),
    ).toBeInTheDocument();

    // The post title is the suggested text
    const texto = within(dialog).getByLabelText("Texto da arte");
    expect(texto).toHaveValue("Checklist");
    await user.clear(texto);
    await user.type(texto, "5 erros na nuvem");

    // White background → dark text (contrast); text at the bottom
    await user.click(
      within(
        within(dialog).getByRole("group", { name: "Cor do fundo" }),
      ).getByRole("button", { name: "Cor #FFFFFF" }),
    );
    await user.click(within(dialog).getByRole("radio", { name: "Base" }));

    const ultimo = canvas.desenharArte.mock.calls.at(-1)!;
    expect(ultimo[1]).toMatchObject({
      largura: 1080,
      altura: 1080,
      cor: "#FFFFFF",
      corTexto: "#101828",
      texto: "5 erros na nuvem",
      posicao: "bottom",
      imagem: null,
    });

    await user.click(
      within(dialog).getByRole("button", { name: "Usar no post" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(canvas.exportarSlide).toHaveBeenCalledWith(
      expect.objectContaining({ texto: "5 erros na nuvem", imagem: null }),
      null,
    );

    // Uploaded through the normal library flow, with the text as description
    expect(fakeApi.requests("POST", "/images/upload-url")[0].body).toEqual({
      project_id: project.id,
      content_type: "image/png",
      size_bytes: 4,
    });
    const criada = fakeApi.requests("POST", "/images")[0].body as {
      description: string;
    };
    expect(criada.description).toBe("5 erros na nuvem");

    // The new image is the post image
    expect(
      await screen.findByRole("img", { name: "5 erros na nuvem" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar post" }));
    await waitFor(() => expect(location()).toBe("/posts"));
    const post = fakeApi.requests("POST", "/posts")[0].body as {
      image_ids: string[];
    };
    expect(post.image_ids).toHaveLength(1);
  });

  it("uses a library photo as background, cropped to cover the artwork", async () => {
    const { project, subject } = seed();
    const foto = fakeApi.addImage(project.id, { description: "Data center" });
    const { user } = await abrirEditor("Backup", subject.id);

    // X: 1600 × 900 by default
    await user.click(screen.getByRole("radio", { name: /^X/ }));
    await user.click(screen.getByRole("radio", { name: /^Imagem única/ }));
    await user.click(screen.getByRole("button", { name: "Criar arte" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("img", {
        name: "Prévia da arte (1600 × 900 px)",
      }),
    ).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("radio", { name: "Imagem da biblioteca" }),
    );
    await user.click(
      await within(dialog).findByRole("button", { name: "Data center" }),
    );
    expect(canvas.carregarImagem).toHaveBeenCalledWith(foto.url);

    // Crop controls appear once the photo is loaded
    const zoom = await within(dialog).findByLabelText("Zoom");
    expect(zoom).toHaveValue("1");
    expect(within(dialog).getByLabelText("Escurecer a imagem")).toHaveValue(
      "0.3",
    );
    const ultimo = canvas.desenharArte.mock.calls.at(-1)!;
    expect(ultimo[1]).toMatchObject({
      largura: 1600,
      altura: 900,
      corTexto: "#FFFFFF",
      imagem: { zoom: 1, focoX: 0.5, focoY: 0.5, escurecer: 0.3 },
    });
    expect(ultimo[2]).toMatchObject({ width: 2000, height: 1000 });

    await user.click(
      within(dialog).getByRole("button", { name: "Usar no post" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    // Photo backgrounds are exported as JPEG (smaller than PNG)
    expect(canvas.exportarSlide).toHaveBeenCalledWith(
      expect.objectContaining({ imagem: expect.objectContaining({ zoom: 1 }) }),
      expect.objectContaining({ width: 2000 }),
    );
    expect(
      fakeApi.requests("POST", "/images/upload-url")[0].body,
    ).toMatchObject({ content_type: "image/jpeg" });
  });

  it("downloads the artwork without saving it to the library", async () => {
    const { subject } = seed();
    const { user } = await abrirEditor("Só baixar", subject.id);

    await user.click(screen.getByRole("button", { name: "Criar arte" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Baixar imagem" }),
    );

    await waitFor(() => expect(canvas.baixarArquivos).toHaveBeenCalledTimes(1));
    expect(canvas.baixarArquivos.mock.calls[0][0]).toEqual([
      { arquivo: expect.any(File), nome: "postpilot-instagram-1080x1350.png" },
    ]);
    // Nothing is uploaded and the editor stays open (the user may still use it)
    expect(fakeApi.requests("POST", "/images/upload-url")).toHaveLength(0);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps the editor open and shows an error when the upload fails", async () => {
    const { subject } = seed();
    canvas.exportarSlide.mockRejectedValueOnce(new Error("toBlob failed"));
    const { user } = await abrirEditor("Post", subject.id);

    await user.click(screen.getByRole("button", { name: "Criar arte" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Usar no post" }),
    );

    expect(
      await within(dialog).findByText(
        "Não foi possível salvar a arte. Tente novamente.",
      ),
    ).toBeInTheDocument();
    expect(fakeApi.requests("POST", "/images")).toHaveLength(0);
  });
});

describe("Artwork editor (carousel)", () => {
  it("creates ordered slides, uploads them in order and adds them to the carousel", async () => {
    const { project, subject } = seed();
    const existente = fakeApi.addImage(project.id, {
      description: "Capa antiga",
    });
    const { user, location } = await abrirEditor("Guia da nuvem", subject.id);
    await user.click(screen.getByRole("radio", { name: /^Carrossel/ }));

    // One image already in the carousel: 19 slides still fit (Instagram: 20)
    await user.click(screen.getByRole("button", { name: "Escolher" }));
    const biblioteca = await screen.findByRole("dialog");
    await user.click(
      await within(biblioteca).findByRole("button", { name: "Capa antiga" }),
    );
    await user.click(
      within(biblioteca).getByRole("button", { name: "Concluir (1)" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Criar slides do carrossel")).toBeInTheDocument();
    expect(screen.getByText(/Cabem mais 19\./)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Criar arte" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", {
        name: "Criar carrossel para o Instagram",
      }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Texto do slide 1")).toHaveValue(
      "Guia da nuvem",
    );

    // Slide 2: same look, no text; slide 3 is a duplicate of slide 2
    await user.click(
      within(dialog).getByRole("button", {
        name: "Novo slide (mesmo visual, sem texto)",
      }),
    );
    const texto2 = within(dialog).getByLabelText("Texto do slide 2");
    expect(texto2).toHaveValue("");
    await user.type(texto2, "Passo 1");
    await user.click(within(dialog).getByRole("button", { name: /Duplicar/ }));
    const texto3 = within(dialog).getByLabelText("Texto do slide 3");
    expect(texto3).toHaveValue("Passo 1");
    await user.clear(texto3);
    await user.type(texto3, "Passo 2");
    expect(
      within(dialog).getByText("Slide 3 de 3 (máximo 19)"),
    ).toBeInTheDocument();

    // Move "Passo 2" before "Passo 1", then go back to slide 1
    await user.click(within(dialog).getByRole("button", { name: /Antes/ }));
    expect(within(dialog).getByLabelText("Texto do slide 2")).toHaveValue(
      "Passo 2",
    );
    await user.click(within(dialog).getByRole("button", { name: "Slide 1" }));
    expect(within(dialog).getByLabelText("Texto do slide 1")).toHaveValue(
      "Guia da nuvem",
    );

    await user.click(
      within(dialog).getByRole("button", { name: "Usar no post (3)" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    // Uploaded one by one, in the slide order, each with its own text
    const criadas = fakeApi
      .requests("POST", "/images")
      .map((r) => (r.body as { description: string }).description);
    expect(criadas).toEqual(["Guia da nuvem", "Passo 2", "Passo 1"]);
    expect(screen.getByText("4 de 20")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Criar post" }));
    await waitFor(() => expect(location()).toBe("/posts"));
    const post = fakeApi.requests("POST", "/posts")[0].body as {
      format: string;
      image_ids: string[];
    };
    expect(post.format).toBe("carousel");
    // The old image stays first; the slides come after, in order
    expect(post.image_ids).toHaveLength(4);
    expect(post.image_ids[0]).toBe(existente.id);
  });

  it("removes slides, downloads numbered files and respects the X limit", async () => {
    const { subject } = seed();
    const { user } = await abrirEditor("Fio", subject.id);
    await user.click(screen.getByRole("radio", { name: /^X/ }));
    await user.click(screen.getByRole("radio", { name: /^Várias imagens/ }));
    await user.click(screen.getByRole("button", { name: "Criar arte" }));
    const dialog = await screen.findByRole("dialog");

    // X: up to 4 images → 4 slides, then "new slide" is disabled
    const novo = within(dialog).getByRole("button", {
      name: "Novo slide (mesmo visual, sem texto)",
    });
    await user.click(novo);
    await user.click(novo);
    await user.click(novo);
    expect(novo).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: /Duplicar/ }),
    ).toBeDisabled();

    await user.click(within(dialog).getByRole("button", { name: /Remover/ }));
    expect(
      within(dialog).getByText("Slide 3 de 3 (máximo 4)"),
    ).toBeInTheDocument();
    expect(novo).toBeEnabled();

    await user.click(
      within(dialog).getByRole("button", { name: "Baixar slides (3)" }),
    );
    await waitFor(() => expect(canvas.baixarArquivos).toHaveBeenCalledTimes(1));
    expect(canvas.baixarArquivos.mock.calls[0][0].map((a) => a.nome)).toEqual([
      "postpilot-x-1600x900-01.png",
      "postpilot-x-1600x900-02.png",
      "postpilot-x-1600x900-03.png",
    ]);
    expect(fakeApi.requests("POST", "/images/upload-url")).toHaveLength(0);
  });

  it("is disabled when the carousel is already full", async () => {
    const { project, subject } = seed();
    const imagens = [1, 2, 3, 4].map((n) =>
      fakeApi.addImage(project.id, { description: `Foto ${n}` }),
    );
    const post = fakeApi.addPost(subject.id, {
      title: "Cheio",
      network: "x",
      format: "carousel",
      image_ids: imagens.map((i) => i.id),
    });
    renderPage(<PostFormPage />, {
      path: "/posts/:id",
      route: `/posts/${post.id}`,
    });

    expect(
      await screen.findByText(
        "O carrossel já está com o máximo de imagens. Remova alguma para criar novos slides.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar arte" })).toBeDisabled();
  });

  it("after a failed upload, retrying does not upload the saved slides again", async () => {
    const { subject } = seed();
    const { user } = await abrirEditor("Retry", subject.id);
    await user.click(screen.getByRole("radio", { name: /^Carrossel/ }));
    await user.click(screen.getByRole("button", { name: "Criar arte" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", {
        name: "Novo slide (mesmo visual, sem texto)",
      }),
    );

    // Slide 1 is exported and uploaded; slide 2 fails
    const padrao = canvas.exportarSlide.getMockImplementation()!;
    canvas.exportarSlide
      .mockImplementationOnce(padrao)
      .mockRejectedValueOnce(new Error("toBlob failed"));
    await user.click(
      within(dialog).getByRole("button", { name: "Usar no post (2)" }),
    );
    expect(
      await within(dialog).findByText(
        "Não foi possível salvar a arte. Tente novamente.",
      ),
    ).toBeInTheDocument();
    expect(fakeApi.requests("POST", "/images")).toHaveLength(1);

    await user.click(
      within(dialog).getByRole("button", { name: "Usar no post (2)" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    // Only slide 2 was uploaded on the retry
    expect(fakeApi.requests("POST", "/images")).toHaveLength(2);
    expect(screen.getByText("2 de 20")).toBeInTheDocument();
  });
});
