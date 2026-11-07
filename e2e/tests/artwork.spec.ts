import type { Locator, Page } from "@playwright/test";
import { confirmDelete, expect, login, test, unique } from "./fixtures";

/** Color of one pixel of the editor preview (the real <canvas>). */
function pixel(page: Page, x: number, y: number) {
  return page.evaluate(
    ([px, py]) => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        '[role="dialog"] canvas[role="img"]',
      )!;
      const [r, g, b] = canvas
        .getContext("2d")!
        .getImageData(px, py, 1, 1).data;
      return { r, g, b };
    },
    [x, y],
  );
}

/** Pixel color by name, tolerating JPEG rounding (the mock API stores a JPEG copy). */
async function colorAt(page: Page, x: number, y: number) {
  const { r, g, b } = await pixel(page, x, y);
  const near = (v: number, alvo: number) => Math.abs(v - alvo) <= 8;
  if (near(r, 255) && near(g, 0) && near(b, 0)) return "red";
  if (near(r, 0) && near(g, 0) && near(b, 255)) return "blue";
  return `rgb(${r}, ${g}, ${b})`;
}

/** Option of the editor (visually hidden radio inside its label: click the label). */
function option(dialog: Locator, name: string) {
  return dialog.locator("label").filter({ hasText: new RegExp(`^${name}$`) });
}

/** Wide test photo (800 × 400): left half red, right half blue. */
async function widePhoto(page: Page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 400;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#FF0000";
    ctx.fillRect(0, 0, 400, 400);
    ctx.fillStyle = "#0000FF";
    ctx.fillRect(400, 0, 400, 400);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  return Buffer.from(base64, "base64");
}

/**
 * Artwork editor (single image): the canvas has the network size, draws the
 * color and the text with the app font, covers the artwork with a library
 * photo (cropped, not stretched) and the exported file becomes the post image.
 */
test("artwork editor: color, library photo and text become the post image", async ({
  page,
}) => {
  const project = unique("E2E Arte");
  const subject = unique("E2E Assunto");
  const title = unique("E2E Post arte");

  await login(page);

  await test.step("project, subject and a wide photo in the library", async () => {
    await page.goto("/projects/new");
    await page.getByLabel(/^Nome/).fill(project);
    await page.getByRole("button", { name: "Criar projeto" }).click();
    await expect(page).toHaveURL(/\/projects$/);

    await page.goto("/subjects/new");
    await page.getByLabel(/^Nome/).fill(subject);
    await page.getByRole("button", { name: "Criar assunto" }).click();
    await expect(page).toHaveURL(/\/subjects$/);

    await page.goto("/images");
    await page
      .getByLabel("Enviar imagens")
      .setInputFiles({
        name: "foto.png",
        mimeType: "image/png",
        buffer: await widePhoto(page),
      });
    await expect(
      page.getByRole("button", { name: "Ampliar imagem 1" }),
    ).toBeVisible();
  });

  await test.step("open the editor: Instagram 4:5, brand color", async () => {
    await page.goto("/posts/new");
    await page.getByLabel(/^Título/).fill(title);
    await page.getByLabel(/^Assunto/).selectOption({ label: subject });
    await page.getByRole("button", { name: "Criar arte" }).click();

    const dialog = page.getByRole("dialog");
    const canvas = dialog.getByRole("img", {
      name: "Prévia da arte (1080 × 1350 px)",
    });
    await expect(canvas).toHaveAttribute("width", "1080");
    await expect(canvas).toHaveAttribute("height", "1350");
    await expect(dialog.getByLabel("Texto da arte")).toHaveValue(title);
    // The art font is loaded before drawing (otherwise the PNG uses a fallback font)
    await expect(
      dialog.getByRole("button", { name: "Usar no post" }),
    ).toBeEnabled();
    expect(
      await page.evaluate(() => document.fonts.check("600 64px Outfit")),
    ).toBe(true);
    // Corner = background color #465FFF
    expect(await pixel(page, 5, 5)).toEqual({ r: 0x46, g: 0x5f, b: 0xff });
  });

  await test.step("library photo covers the 4:5 artwork, cropped at the center", async () => {
    const dialog = page.getByRole("dialog");
    await option(dialog, "Imagem da biblioteca").click();
    await dialog.getByRole("button", { name: "Imagem 1" }).click();
    await expect(dialog.getByLabel("Zoom")).toBeVisible();
    await dialog.getByLabel("Escurecer a imagem").fill("0");
    await dialog.getByLabel("Texto da arte").fill("Topo");
    await option(dialog, "Topo").click();
    await expect(dialog.getByRole("radio", { name: "Topo" })).toBeChecked();

    // 800×400 → 4:5: a 320 px wide slice from the center (red | blue), no stretching
    await expect.poll(() => colorAt(page, 5, 1340)).toBe("red");
    expect(await colorAt(page, 1075, 1340)).toBe("blue");

    // Image center on the right edge: only its red (left) half is in view (the
    // red | blue boundary is now at x = 1080, so check a bit before it)
    await dialog.getByLabel("Posição horizontal").fill("1");
    await expect.poll(() => colorAt(page, 1040, 1340)).toBe("red");
  });

  await test.step("drag the photo down: the background color shows above it", async () => {
    const dialog = page.getByRole("dialog");
    const preview = dialog.getByRole("img", { name: /^Prévia da arte/ });
    const box = (await preview.boundingBox())!;
    // Start below the text (it is at the top), move down 30% of the preview
    const start = { x: box.x + box.width / 2, y: box.y + box.height * 0.6 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y + box.height * 0.3, { steps: 8 });
    await page.mouse.up();

    // Top-left: background color (no photo); bottom-left: still the red photo
    await expect.poll(() => colorAt(page, 5, 300)).not.toMatch(/red|blue/);
    expect(await colorAt(page, 5, 1340)).toBe("red");
    await expect(dialog.getByText("Cor em volta da imagem")).toBeVisible();

    // "Cover the artwork" puts it back: centered, red | blue
    await dialog.getByRole("button", { name: "Cobrir a arte" }).click();
    await expect.poll(() => colorAt(page, 1075, 1340)).toBe("blue");
    expect(await colorAt(page, 5, 300)).toBe("red");
  });

  await test.step("download the artwork (no upload)", async () => {
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Baixar imagem" })
      .click();
    const download = await downloadPromise;
    // Photo background → JPEG, named after the network and size
    expect(download.suggestedFilename()).toBe(
      "postpilot-instagram-1080x1350.jpg",
    );
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  await test.step("use in post: exported, uploaded to the library and chosen", async () => {
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Usar no post" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const thumb = page.getByRole("img", { name: "Topo", exact: true });
    await expect(thumb).toBeVisible();
    // Same 4:5 proportion as the artwork (the canvas was exportable: not tainted by CORS)
    const ratio = await thumb.evaluate(
      (img: HTMLImageElement) => img.naturalWidth / img.naturalHeight,
    );
    expect(ratio).toBeCloseTo(0.8, 2);

    await page.getByRole("button", { name: "Criar post" }).click();
    await expect(page).toHaveURL(/\/posts$/);
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toBeVisible();
  });

  await test.step("cleanup: post, images, subject and project", async () => {
    await page.getByRole("button", { name: `Excluir ${title}` }).click();
    await confirmDelete(page);
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toHaveCount(0);

    await page.goto("/images");
    for (const remaining of [1, 0]) {
      await page.getByRole("button", { name: "Excluir imagem 1" }).click();
      await confirmDelete(page);
      await expect(
        page.getByRole("button", { name: /^Excluir imagem/ }),
      ).toHaveCount(remaining);
    }

    await page.goto("/subjects");
    await page.getByRole("button", { name: `Excluir ${subject}` }).click();
    await confirmDelete(page);
    await expect(
      page.getByRole("link", { name: subject, exact: true }),
    ).toHaveCount(0);

    await page.goto("/projects");
    await page.getByRole("button", { name: `Excluir ${project}` }).click();
    await confirmDelete(page);
    await expect(page.getByRole("heading", { name: project })).toHaveCount(0);
  });
});

/**
 * Carousel: several slides in the same size, each with its own background and
 * text; downloaded as numbered files or uploaded in order to the post.
 */
test("artwork editor: carousel slides become the post images, in order", async ({ page }) => {
  const project = unique("E2E Carrossel");
  const subject = unique("E2E Assunto");
  const title = unique("E2E Post carrossel");

  await login(page);
  await page.goto("/projects/new");
  await page.getByLabel(/^Nome/).fill(project);
  await page.getByRole("button", { name: "Criar projeto" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.goto("/subjects/new");
  await page.getByLabel(/^Nome/).fill(subject);
  await page.getByRole("button", { name: "Criar assunto" }).click();
  await expect(page).toHaveURL(/\/subjects$/);

  await page.goto("/posts/new");
  await page.getByLabel(/^Título/).fill(title);
  await page.getByLabel(/^Assunto/).selectOption({ label: subject });
  await page.locator("label").filter({ hasText: /^Carrossel/ }).click();
  await page.getByRole("button", { name: "Criar arte" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Criar carrossel para o Instagram" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Usar no post (1)" })).toBeEnabled();

  await test.step("two slides: brand color, then black with other text", async () => {
    await dialog.getByRole("button", { name: "Novo slide (mesmo visual, sem texto)" }).click();
    await dialog
      .getByRole("group", { name: "Cor do fundo" })
      .getByRole("button", { name: "Cor #101828" })
      .click();
    await dialog.getByLabel("Texto do slide 2").fill("Segundo slide");
    // Preview = slide 2 (black); slide 1 keeps the brand color
    await expect.poll(() => pixel(page, 5, 5)).toEqual({ r: 0x10, g: 0x18, b: 0x28 });
    await dialog.getByRole("button", { name: "Slide 1" }).click();
    await expect.poll(() => pixel(page, 5, 5)).toEqual({ r: 0x46, g: 0x5f, b: 0xff });
  });

  await test.step("download: one numbered file per slide", async () => {
    const nomes: string[] = [];
    page.on("download", (d) => nomes.push(d.suggestedFilename()));
    await dialog.getByRole("button", { name: "Baixar slides (2)" }).click();
    await expect.poll(() => nomes.length).toBe(2);
    expect(nomes).toEqual([
      "postpilot-instagram-1080x1350-01.png",
      "postpilot-instagram-1080x1350-02.png",
    ]);
  });

  await test.step("use in post: both slides in the carousel, in order", async () => {
    await dialog.getByRole("button", { name: "Usar no post (2)" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("2 de 20")).toBeVisible();
    await expect(page.getByRole("img", { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "Segundo slide", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Criar post" }).click();
    await expect(page).toHaveURL(/\/posts$/);
    await expect(page.getByRole("row").filter({ hasText: title })).toContainText("Carrossel");
  });

  await test.step("cleanup: post, images, subject and project", async () => {
    await page.getByRole("button", { name: `Excluir ${title}` }).click();
    await confirmDelete(page);
    await expect(page.getByRole("link", { name: title, exact: true })).toHaveCount(0);

    await page.goto("/images");
    for (const remaining of [1, 0]) {
      await page.getByRole("button", { name: "Excluir imagem 1" }).click();
      await confirmDelete(page);
      await expect(page.getByRole("button", { name: /^Excluir imagem/ })).toHaveCount(remaining);
    }

    await page.goto("/subjects");
    await page.getByRole("button", { name: `Excluir ${subject}` }).click();
    await confirmDelete(page);
    await expect(
      page.getByRole("link", { name: subject, exact: true }),
    ).toHaveCount(0);
    await page.goto("/projects");
    await page.getByRole("button", { name: `Excluir ${project}` }).click();
    await confirmDelete(page);
    await expect(page.getByRole("heading", { name: project })).toHaveCount(0);
  });
});

/** Number of white (text) pixels in a rectangle of the editor preview. */
function whitePixels(page: Page, x: number, y: number, w: number, h: number) {
  return page.evaluate(
    ([rx, ry, rw, rh]) => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        '[role="dialog"] canvas[role="img"]',
      )!;
      const data = canvas.getContext("2d")!.getImageData(rx, ry, rw, rh).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) count++;
      }
      return count;
    },
    [x, y, w, h],
  );
}

/**
 * Free text position: dragging the text in the preview moves it (the real
 * canvas redraws it there); a fixed position puts it back.
 */
test("artwork editor: drag the text to any position", async ({ page }) => {
  const project = unique("E2E Arraste");
  const subject = unique("E2E Assunto");

  await login(page);
  await page.goto("/projects/new");
  await page.getByLabel(/^Nome/).fill(project);
  await page.getByRole("button", { name: "Criar projeto" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.goto("/subjects/new");
  await page.getByLabel(/^Nome/).fill(subject);
  await page.getByRole("button", { name: "Criar assunto" }).click();
  await expect(page).toHaveURL(/\/subjects$/);

  await page.goto("/posts/new");
  await page.getByLabel(/^Título/).fill("Texto");
  await page.getByLabel(/^Assunto/).selectOption({ label: subject });
  await page.getByRole("button", { name: "Criar arte" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Usar no post" })).toBeEnabled();

  // 1080 × 1350, brand color, white text in the middle
  const topLeft = () => whitePixels(page, 0, 0, 540, 500);
  const middle = () => whitePixels(page, 0, 575, 1080, 200);
  await expect.poll(middle).toBeGreaterThan(0);
  expect(await topLeft()).toBe(0);

  await test.step("drag the text to the top-left corner", async () => {
    const preview = dialog.getByRole("img", { name: /^Prévia da arte/ });
    const box = (await preview.boundingBox())!;
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    // Several steps, like a real drag; far beyond the corner (stops at the margin)
    await page.mouse.move(box.x - 50, box.y - 50, { steps: 8 });
    await page.mouse.up();

    await expect.poll(topLeft).toBeGreaterThan(0);
    expect(await middle()).toBe(0);
    await expect(dialog.getByText(/^Posição livre/)).toBeVisible();
    // The safe margin (8% = 86 px) stays empty
    expect(await whitePixels(page, 0, 0, 80, 80)).toBe(0);
  });

  await test.step("a fixed position puts the text back", async () => {
    await option(dialog, "Meio").click();
    await expect.poll(middle).toBeGreaterThan(0);
    expect(await topLeft()).toBe(0);
  });

  await test.step("cleanup: subject and project", async () => {
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await page.goto("/subjects");
    await page.getByRole("button", { name: `Excluir ${subject}` }).click();
    await confirmDelete(page);
    await expect(page.getByRole("link", { name: subject, exact: true })).toHaveCount(0);
    await page.goto("/projects");
    await page.getByRole("button", { name: `Excluir ${project}` }).click();
    await confirmDelete(page);
    await expect(page.getByRole("heading", { name: project })).toHaveCount(0);
  });
});
