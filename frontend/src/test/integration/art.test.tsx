// Integration: the artwork editor in the post form. jsdom has no canvas, so
// the drawing module is replaced; the size, the choices, the upload to the
// library (presigned URL + S3 + POST /images) and the post body are real.
import PostFormPage from "@/pages/Posts/PostFormPage";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeApi } from "../fakeApi";
import { renderPage } from "../render";

const canvas = vi.hoisted(() => ({
  drawArt: vi.fn(),
  // Text block of the artwork (artwork pixels): 400 × 150, centered at (540, 675)
  textArea: vi.fn(() => ({
    left: 340,
    top: 600,
    width: 400,
    height: 150,
    anchorX: 540,
  })),
  downloadFiles: vi.fn<
    (files: { file: File; name: string }[]) => Promise<void>
  >(() => Promise.resolve()),
  loadFont: vi.fn(() => Promise.resolve()),
  loadImage: vi.fn<
    (
      url: string,
    ) => Promise<{ width: number; height: number; close: () => void }>
  >(() => Promise.resolve({ width: 2000, height: 1000, close: () => {} })),
  exportSlide: vi.fn<
    (art: { image: unknown }, background: unknown) => Promise<File>
  >((art) =>
    Promise.resolve(
      new File(["arte"], art.image ? "arte.jpg" : "arte.png", {
        type: art.image ? "image/jpeg" : "image/png",
      }),
    ),
  ),
}));
vi.mock("@/features/art/canvas", () => canvas);

beforeEach(() => vi.clearAllMocks());

function seed() {
  const project = fakeApi.addProject();
  const subject = fakeApi.addSubject(project.id, { name: "Cloud" });
  return { project, subject };
}

async function openEditor(title: string, subjectId: string) {
  const r = renderPage(<PostFormPage />, { path: "/posts/new" });
  await r.user.type(await screen.findByLabelText(/^Título/), title);
  await r.user.selectOptions(screen.getByLabelText(/^Assunto/), subjectId);
  return r;
}

describe("Artwork editor (post form, single image)", () => {
  it("creates a color + text artwork, saves it to the library and uses it in the post", async () => {
    const { project, subject } = seed();
    const { user, location } = await openEditor("Checklist", subject.id);

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
    const text = within(dialog).getByLabelText("Texto da arte");
    expect(text).toHaveValue("Checklist");
    await user.clear(text);
    await user.type(text, "5 erros na nuvem");

    // White background → dark text (contrast); text at the bottom
    await user.click(
      within(
        within(dialog).getByRole("group", { name: "Cor do fundo" }),
      ).getByRole("button", { name: "Cor #FFFFFF" }),
    );
    await user.click(within(dialog).getByRole("radio", { name: "Base" }));

    const last = canvas.drawArt.mock.calls.at(-1)!;
    expect(last[1]).toMatchObject({
      width: 1080,
      height: 1080,
      color: "#FFFFFF",
      textColor: "#101828",
      text: "5 erros na nuvem",
      position: "bottom",
      image: null,
    });

    await user.click(
      within(dialog).getByRole("button", { name: "Usar no post" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(canvas.exportSlide).toHaveBeenCalledWith(
      expect.objectContaining({ text: "5 erros na nuvem", image: null }),
      null,
    );

    // Uploaded through the normal library flow, with the text as description
    expect(fakeApi.requests("POST", "/images/upload-url")[0].body).toEqual({
      project_id: project.id,
      content_type: "image/png",
      size_bytes: 4,
    });
    const created = fakeApi.requests("POST", "/images")[0].body as {
      description: string;
    };
    expect(created.description).toBe("5 erros na nuvem");

    // The new image is the post image
    expect(
      await screen.findByRole("img", { name: "5 erros na nuvem" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar post" }));
    await waitFor(() => expect(location()).toBe("/posts"));
    const post = fakeApi.requests("POST", "/posts")[0].body as {
      variations: { image_ids: string[] }[];
    };
    expect(post.variations[0].image_ids).toHaveLength(1);
  });

  it("uses a library photo as background, cropped to cover the artwork", async () => {
    const { project, subject } = seed();
    const photo = fakeApi.addImage(project.id, { description: "Data center" });
    const { user } = await openEditor("Backup", subject.id);

    // X: 1600 × 900 by default
    // X instead of Instagram: check X, uncheck Instagram (one variation)
    await user.click(screen.getByRole("checkbox", { name: /^X/ }));
    await user.click(screen.getByRole("checkbox", { name: /^Instagram/ }));
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
    expect(canvas.loadImage).toHaveBeenCalledWith(photo.url);

    // Crop controls appear once the photo is loaded
    const zoom = await within(dialog).findByLabelText("Zoom");
    expect(zoom).toHaveValue("1");
    expect(within(dialog).getByLabelText("Escurecer a imagem")).toHaveValue(
      "0.3",
    );
    const last = canvas.drawArt.mock.calls.at(-1)!;
    expect(last[1]).toMatchObject({
      width: 1600,
      height: 900,
      textColor: "#FFFFFF",
      image: { zoom: 1, x: 0.5, y: 0.5, darken: 0.3 },
    });
    expect(last[2]).toMatchObject({ width: 2000, height: 1000 });

    await user.click(
      within(dialog).getByRole("button", { name: "Usar no post" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    // Photo backgrounds are exported as JPEG (smaller than PNG)
    expect(canvas.exportSlide).toHaveBeenCalledWith(
      expect.objectContaining({ image: expect.objectContaining({ zoom: 1 }) }),
      expect.objectContaining({ width: 2000 }),
    );
    expect(
      fakeApi.requests("POST", "/images/upload-url")[0].body,
    ).toMatchObject({ content_type: "image/jpeg" });
  });

  it("downloads the artwork without saving it to the library", async () => {
    const { subject } = seed();
    const { user } = await openEditor("Só baixar", subject.id);

    await user.click(screen.getByRole("button", { name: "Criar arte" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Baixar imagem" }),
    );

    await waitFor(() => expect(canvas.downloadFiles).toHaveBeenCalledTimes(1));
    expect(canvas.downloadFiles.mock.calls[0][0]).toEqual([
      { file: expect.any(File), name: "postpilot-instagram-1080x1350.png" },
    ]);
    // Nothing is uploaded and the editor stays open (the user may still use it)
    expect(fakeApi.requests("POST", "/images/upload-url")).toHaveLength(0);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("drags the text to a free position; a fixed position puts it back", async () => {
    const { subject } = seed();
    const { user } = await openEditor("Arrastar", subject.id);
    await user.click(screen.getByRole("button", { name: "Criar arte" }));
    const dialog = await screen.findByRole("dialog");

    // 1080 × 1350 preview shown at half size: 1 screen px = 2 artwork px
    const preview = within(dialog).getByRole("img", {
      name: /^Prévia da arte/,
    });
    vi.spyOn(preview, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 0, width: 540, height: 675 }),
    );
    preview.setPointerCapture = vi.fn();
    const lastArt = () => canvas.drawArt.mock.calls.at(-1)![1];

    // Pressing outside the text on a color background does nothing
    fireEvent.pointerDown(preview, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(preview, { pointerId: 1, clientX: 60, clientY: 60 });
    fireEvent.pointerUp(preview, { pointerId: 1 });
    expect(lastArt().point).toBeNull();

    // Drag the text (center 270, 337 on screen) 50 left and 200 up
    fireEvent.pointerDown(preview, {
      pointerId: 1,
      clientX: 270,
      clientY: 337,
    });
    fireEvent.pointerMove(preview, {
      pointerId: 1,
      clientX: 220,
      clientY: 137,
    });
    fireEvent.pointerUp(preview, { pointerId: 1 });

    // Block center (540, 675) → (440, 275) in artwork pixels
    expect(lastArt().point).toEqual({
      x: expect.closeTo(440 / 1080, 5),
      y: expect.closeTo(275 / 1350, 5),
    });
    expect(
      within(dialog).getByRole("radio", { name: "Meio" }),
    ).not.toBeChecked();
    expect(within(dialog).getByText(/^Posição livre/)).toBeInTheDocument();

    // Dragging far beyond the edge stops at the margin (86 px + half the block)
    fireEvent.pointerDown(preview, {
      pointerId: 1,
      clientX: 270,
      clientY: 337,
    });
    fireEvent.pointerMove(preview, {
      pointerId: 1,
      clientX: -900,
      clientY: 337,
    });
    fireEvent.pointerUp(preview, { pointerId: 1 });
    expect(lastArt().point.x).toBeCloseTo((86 + 200) / 1080, 5);

    // A fixed position resets the free point
    await user.click(within(dialog).getByRole("radio", { name: "Topo" }));
    expect(lastArt()).toMatchObject({ point: null, position: "top" });
    expect(within(dialog).getByRole("radio", { name: "Topo" })).toBeChecked();

    // The exported artwork keeps the dragged position
    fireEvent.pointerDown(preview, {
      pointerId: 1,
      clientX: 270,
      clientY: 337,
    });
    fireEvent.pointerMove(preview, {
      pointerId: 1,
      clientX: 270,
      clientY: 437,
    });
    fireEvent.pointerUp(preview, { pointerId: 1 });
    await user.click(
      within(dialog).getByRole("button", { name: "Usar no post" }),
    );
    await waitFor(() => expect(canvas.exportSlide).toHaveBeenCalledTimes(1));
    expect(canvas.exportSlide.mock.calls[0][0]).toMatchObject({
      point: { x: expect.closeTo(0.5, 5), y: expect.closeTo(875 / 1350, 5) },
    });
  });

  it("drags the background image freely; the color shows around it until it covers again", async () => {
    const { project, subject } = seed();
    fakeApi.addImage(project.id, { description: "Data center" });
    const { user } = await openEditor("Imagem", subject.id);
    await user.click(screen.getByRole("button", { name: "Criar arte" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("radio", { name: "Imagem da biblioteca" }),
    );
    await user.click(
      await within(dialog).findByRole("button", { name: "Data center" }),
    );
    await within(dialog).findByLabelText("Zoom");

    // Covering the artwork: no color choice, nothing to reset
    expect(
      within(dialog).queryByRole("group", { name: "Cor em volta da imagem" }),
    ).not.toBeInTheDocument();
    const cover = within(dialog).getByRole("button", {
      name: "Cobrir a arte",
    });
    expect(cover).toBeDisabled();

    // 1080 × 1350 preview shown at half size: 1 screen px = 2 artwork px
    const preview = within(dialog).getByRole("img", {
      name: /^Prévia da arte/,
    });
    vi.spyOn(preview, "getBoundingClientRect").mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 0, width: 540, height: 675 }),
    );
    preview.setPointerCapture = vi.fn();
    const lastArt = () => canvas.drawArt.mock.calls.at(-1)![1];

    // Outside the text: the image moves with the pointer (also vertically,
    // where the old crop had nothing left to show)
    fireEvent.pointerDown(preview, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(preview, {
      pointerId: 1,
      clientX: 104,
      clientY: 185,
    });
    fireEvent.pointerUp(preview, { pointerId: 1 });
    expect(lastArt().image).toMatchObject({
      x: expect.closeTo(0.5 + 108 / 1080, 5),
      y: expect.closeTo(0.5 + 270 / 1350, 5),
    });
    expect(lastArt().point).toBeNull(); // the text did not move

    // Far beyond the edge: the image center stops at the edge
    fireEvent.pointerDown(preview, { pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(preview, {
      pointerId: 1,
      clientX: -2000,
      clientY: 50,
    });
    fireEvent.pointerUp(preview, { pointerId: 1 });
    expect(lastArt().image.x).toBe(0);

    // The background color now shows: it can be chosen (the text color stays)
    const colors = await within(dialog).findByRole("group", {
      name: "Cor em volta da imagem",
    });
    await user.click(within(colors).getAllByRole("button")[1]);
    expect(lastArt()).toMatchObject({ color: "#101828", textColor: "#FFFFFF" });

    // Back to covering the artwork (the darkening is kept)
    await user.click(cover);
    expect(lastArt().image).toEqual({
      zoom: 1,
      x: 0.5,
      y: 0.5,
      darken: 0.3,
    });
    expect(
      within(dialog).queryByRole("group", { name: "Cor em volta da imagem" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the editor open and shows an error when the upload fails", async () => {
    const { subject } = seed();
    canvas.exportSlide.mockRejectedValueOnce(new Error("toBlob failed"));
    const { user } = await openEditor("Post", subject.id);

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
    const existing = fakeApi.addImage(project.id, {
      description: "Capa antiga",
    });
    const { user, location } = await openEditor("Guia da nuvem", subject.id);
    await user.click(screen.getByRole("radio", { name: /^Carrossel/ }));

    // One image already in the carousel: 19 slides still fit (Instagram: 20)
    await user.click(screen.getByRole("button", { name: "Escolher" }));
    const library = await screen.findByRole("dialog");
    await user.click(
      await within(library).findByRole("button", { name: "Capa antiga" }),
    );
    await user.click(
      within(library).getByRole("button", { name: "Concluir (1)" }),
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
    const text2 = within(dialog).getByLabelText("Texto do slide 2");
    expect(text2).toHaveValue("");
    await user.type(text2, "Passo 1");
    await user.click(within(dialog).getByRole("button", { name: /Duplicar/ }));
    const text3 = within(dialog).getByLabelText("Texto do slide 3");
    expect(text3).toHaveValue("Passo 1");
    await user.clear(text3);
    await user.type(text3, "Passo 2");
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
    const createdTitles = fakeApi
      .requests("POST", "/images")
      .map((r) => (r.body as { description: string }).description);
    expect(createdTitles).toEqual(["Guia da nuvem", "Passo 2", "Passo 1"]);
    expect(screen.getByText("4 de 20")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Criar post" }));
    await waitFor(() => expect(location()).toBe("/posts"));
    const post = (
      fakeApi.requests("POST", "/posts")[0].body as {
        variations: { format: string; image_ids: string[] }[];
      }
    ).variations[0];
    expect(post.format).toBe("carousel");
    // The old image stays first; the slides come after, in order
    expect(post.image_ids).toHaveLength(4);
    expect(post.image_ids[0]).toBe(existing.id);
  });

  it("removes slides, downloads numbered files and respects the X limit", async () => {
    const { subject } = seed();
    const { user } = await openEditor("Fio", subject.id);
    // X instead of Instagram: check X, uncheck Instagram (one variation)
    await user.click(screen.getByRole("checkbox", { name: /^X/ }));
    await user.click(screen.getByRole("checkbox", { name: /^Instagram/ }));
    await user.click(screen.getByRole("radio", { name: /^Várias imagens/ }));
    await user.click(screen.getByRole("button", { name: "Criar arte" }));
    const dialog = await screen.findByRole("dialog");

    // X: up to 4 images → 4 slides, then "new slide" is disabled
    const newItem = within(dialog).getByRole("button", {
      name: "Novo slide (mesmo visual, sem texto)",
    });
    await user.click(newItem);
    await user.click(newItem);
    await user.click(newItem);
    expect(newItem).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: /Duplicar/ }),
    ).toBeDisabled();

    await user.click(within(dialog).getByRole("button", { name: /Remover/ }));
    expect(
      within(dialog).getByText("Slide 3 de 3 (máximo 4)"),
    ).toBeInTheDocument();
    expect(newItem).toBeEnabled();

    await user.click(
      within(dialog).getByRole("button", { name: "Baixar slides (3)" }),
    );
    await waitFor(() => expect(canvas.downloadFiles).toHaveBeenCalledTimes(1));
    expect(canvas.downloadFiles.mock.calls[0][0].map((a) => a.name)).toEqual([
      "postpilot-x-1600x900-01.png",
      "postpilot-x-1600x900-02.png",
      "postpilot-x-1600x900-03.png",
    ]);
    expect(fakeApi.requests("POST", "/images/upload-url")).toHaveLength(0);
  });

  it("is disabled when the carousel is already full", async () => {
    const { project, subject } = seed();
    const images = [1, 2, 3, 4].map((n) =>
      fakeApi.addImage(project.id, { description: `Foto ${n}` }),
    );
    const post = fakeApi.addPost(subject.id, {
      title: "Cheio",
      variations: [
        {
          network: "x",
          format: "carousel",
          image_ids: images.map((i) => i.id),
        },
      ],
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
    const { user } = await openEditor("Retry", subject.id);
    await user.click(screen.getByRole("radio", { name: /^Carrossel/ }));
    await user.click(screen.getByRole("button", { name: "Criar arte" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", {
        name: "Novo slide (mesmo visual, sem texto)",
      }),
    );

    // Slide 1 is exported and uploaded; slide 2 fails
    const fallback = canvas.exportSlide.getMockImplementation()!;
    canvas.exportSlide
      .mockImplementationOnce(fallback)
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
