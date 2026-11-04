// Integration: image library (/images), including the direct upload to S3
// (presigned URL + XHR PUT, both answered by MSW).
import Imagens from "@/pages/Imagens";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { fakeApi } from "../fakeApi";
import { renderPage } from "../render";

const png = (name = "foto.png") =>
  new File([new Uint8Array([137, 80, 78, 71])], name, { type: "image/png" });

describe("Image library (/images)", () => {
  it("lists the project's images and how many posts use each one", async () => {
    const project = fakeApi.addProject();
    const subject = fakeApi.addSubject(project.id);
    const usada = fakeApi.addImage(project.id, { description: "Nuvem" });
    fakeApi.addImage(project.id, { description: "Evento" });
    fakeApi.addPost(subject.id, { image_id: usada.id });

    renderPage(<Imagens />, { path: "/images" });

    expect(await screen.findByAltText("Nuvem")).toBeInTheDocument();
    expect(screen.getByAltText("Evento")).toBeInTheDocument();
    expect(await screen.findByText("Em 1 post")).toBeInTheDocument();
  });

  it("uploads a file: presigned URL → PUT to S3 → registers the image", async () => {
    const project = fakeApi.addProject();
    const { user } = renderPage(<Imagens />, { path: "/images" });

    await screen.findByText(
      "A biblioteca está vazia. Envie a primeira imagem.",
    );
    await user.upload(screen.getByLabelText("Enviar imagens"), png());

    await waitFor(() => expect(fakeApi.db.images).toHaveLength(1));
    const [uploadUrl] = fakeApi.requests("POST", "/images/upload-url");
    expect(uploadUrl.body).toEqual({
      project_id: project.id,
      content_type: "image/png",
      size_bytes: 4,
    });
    expect(fakeApi.db.uploads.size).toBe(1);
    expect(fakeApi.requests("POST", "/images")[0].body).toMatchObject({
      project_id: project.id,
      content_type: "image/png",
    });
    // The list refreshes with the new image
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: /Ampliar imagem/ }),
      ).toHaveLength(1),
    );
  });

  it("refuses unsupported files before calling the API", async () => {
    fakeApi.addProject();
    renderPage(<Imagens />, { path: "/images" });
    await screen.findByText(
      "A biblioteca está vazia. Envie a primeira imagem.",
    );

    // A drag-and-drop ignores the input's accept attribute, so let the GIF through
    const user = userEvent.setup({ applyAccept: false });
    const gif = new File(["GIF89a"], "anim.gif", { type: "image/gif" });
    await user.upload(screen.getByLabelText("Enviar imagens"), gif);

    expect(
      await screen.findByText("Formato não aceito. Envie PNG, JPG ou WebP."),
    ).toBeInTheDocument();
    expect(fakeApi.requests("POST", "/images/upload-url")).toHaveLength(0);
  });

  it("does not delete an image used by a post (409) but deletes an unused one", async () => {
    const project = fakeApi.addProject();
    const subject = fakeApi.addSubject(project.id);
    const usada = fakeApi.addImage(project.id, { description: "Usada" });
    fakeApi.addImage(project.id, { description: "Livre" });
    fakeApi.addPost(subject.id, { image_id: usada.id });
    const { user } = renderPage(<Imagens />, { path: "/images" });
    await screen.findByAltText("Usada");

    // Images are listed in API order: "Usada" is image 1
    await user.click(screen.getByRole("button", { name: "Excluir imagem 1" }));
    let dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "usada por algum post",
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await user.click(screen.getByRole("button", { name: "Excluir imagem 2" }));
    dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));
    await waitFor(() =>
      expect(screen.queryByAltText("Livre")).not.toBeInTheDocument(),
    );
    expect(fakeApi.db.images.map((i) => i.description)).toEqual(["Usada"]);
  });
});
