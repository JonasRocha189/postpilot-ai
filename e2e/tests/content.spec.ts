import { confirmDelete, expect, login, PNG, test, todayBr, unique } from "./fixtures";

/**
 * Main acceptance flow of the first part of the app: project → subject →
 * image library → post with image → list filters → calendar, then cleanup.
 * Covers the TCC requirements "CRUD of Project, Subject and Post".
 */
test("content flow: project, subject, image, post, calendar", async ({ page }) => {
  const project = unique("E2E Projeto");
  const subject = unique("E2E Assunto");
  const title = unique("E2E Post");

  await login(page);

  await test.step("create a project (it becomes the current one)", async () => {
    await page.goto("/projects/new");
    await page.getByLabel(/^Nome/).fill(project);
    await page.getByLabel("Tom de voz").fill("Direto e didático");
    await page.getByRole("button", { name: "Criar projeto" }).click();

    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("heading", { name: project })).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Projeto atual: ${project}. Trocar de projeto` }),
    ).toBeVisible();
  });

  await test.step("create a subject", async () => {
    await page.getByRole("link", { name: "Assuntos" }).first().click();
    await expect(page).toHaveURL(/\/subjects$/);
    await page.goto("/subjects/new");
    await page.getByLabel(/^Nome/).fill(subject);
    await page.getByRole("button", { name: "Criar assunto" }).click();
    await expect(page).toHaveURL(/\/subjects$/);
    await expect(page.getByRole("link", { name: subject, exact: true })).toBeVisible();
  });

  await test.step("upload an image to the library", async () => {
    await page.goto("/images");
    await expect(page.getByText("A biblioteca está vazia. Envie a primeira imagem.")).toBeVisible();
    await page
      .getByLabel("Enviar imagens")
      .setInputFiles({ name: "pixel.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByRole("button", { name: "Ampliar imagem 1" })).toBeVisible();
  });

  await test.step("create a post with the library image", async () => {
    await page.goto("/posts/new");
    await page.getByLabel(/^Título/).fill(title);
    await page.getByLabel(/^Assunto/).selectOption({ label: subject });
    await page.getByLabel(/^Status/).selectOption("review");
    // Calendar date field: typed as dd/mm/aaaa (a click on the calendar works too)
    await page.getByLabel("Data prevista").fill(todayBr());
    await page.getByLabel("Data prevista").press("Tab");
    await expect(page.getByRole("radio", { name: /^Instagram/ })).toBeChecked();
    await expect(page.getByRole("radio", { name: /^Imagem única/ })).toBeChecked();
    await page.getByLabel("Conteúdo").fill("Texto escrito pelo teste de aceite.");

    await page.getByRole("button", { name: "Escolher", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Imagem 1" }).click();
    await expect(page.getByRole("button", { name: "Trocar imagem" })).toBeVisible();

    await page.getByRole("button", { name: "Criar post" }).click();
    await expect(page).toHaveURL(/\/posts$/);
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toContainText("Em revisão");
    await expect(row).toContainText(subject);
  });

  await test.step("filter posts by status (URL + API)", async () => {
    await page.getByLabel("Status").selectOption("review");
    await expect(page).toHaveURL(/status=review/);
    await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();

    await page.getByLabel("Status").selectOption("approved");
    await expect(page.getByText("Nenhum post com esses filtros.")).toBeVisible();
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();
  });

  await test.step("see the post on the calendar and open it", async () => {
    await page.getByRole("link", { name: "Calendário" }).first().click();
    await expect(page).toHaveURL(/\/calendar$/);
    // Routes load lazily: wait for the calendar before clicking (the old page may still be on screen)
    await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible();
    await page.getByRole("grid").getByText(title).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(subject);
    await dialog.getByRole("link", { name: "Abrir post" }).click();
    await expect(page).toHaveURL(/\/posts\/[^/]+$/);
    await expect(page.getByLabel(/^Título/)).toHaveValue(title);
    await expect(page.getByLabel("Data prevista")).toHaveValue(todayBr());
  });

  await test.step("an image used by a post cannot be deleted (409)", async () => {
    await page.goto("/images");
    await expect(page.getByText("Em 1 post")).toBeVisible();
    await page.getByRole("button", { name: "Excluir imagem 1" }).click();
    const dialog = await confirmDelete(page);
    await expect(dialog.getByRole("alert")).toContainText("usada por algum post");
    await dialog.getByRole("button", { name: "Cancelar" }).click();
  });

  await test.step("cleanup: post, image, subject and project", async () => {
    await page.goto("/posts");
    await page.getByRole("button", { name: `Excluir ${title}` }).click();
    await confirmDelete(page);
    await expect(page.getByRole("link", { name: title, exact: true })).toHaveCount(0);

    await page.goto("/images");
    await page.getByRole("button", { name: "Excluir imagem 1" }).click();
    await confirmDelete(page);
    await expect(page.getByText("A biblioteca está vazia. Envie a primeira imagem.")).toBeVisible();

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

test("form validation and delete conflicts are shown to the user", async ({ page }) => {
  const project = unique("E2E Validação");
  const subject = unique("E2E Assunto");
  await login(page);

  await page.goto("/projects/new");
  await page.getByRole("button", { name: "Criar projeto" }).click();
  await expect(page.getByText("Informe o nome do projeto.")).toBeVisible();
  await page.getByLabel(/^Nome/).fill(project);
  await page.getByRole("button", { name: "Criar projeto" }).click();
  await expect(page).toHaveURL(/\/projects$/);

  await page.goto("/subjects/new");
  await page.getByLabel(/^Nome/).fill(subject);
  await page.getByRole("button", { name: "Criar assunto" }).click();
  await expect(page).toHaveURL(/\/subjects$/);

  await page.goto("/posts/new");
  await page.getByRole("button", { name: "Criar post" }).click();
  await expect(page.getByText("Informe o título do post.")).toBeVisible();
  await expect(page.getByText("Selecione o assunto.")).toBeVisible();

  // A project with subjects cannot be deleted (409 from the API)
  await page.goto("/projects");
  await page.getByRole("button", { name: `Excluir ${project}` }).click();
  const dialog = await confirmDelete(page);
  await expect(dialog.getByRole("alert")).toContainText("ainda tem assuntos");
  await dialog.getByRole("button", { name: "Cancelar" }).click();

  // Cleanup
  await page.goto("/subjects");
  await page.getByRole("button", { name: `Excluir ${subject}` }).click();
  await confirmDelete(page);
  await expect(page.getByRole("link", { name: subject, exact: true })).toHaveCount(0);
  await page.goto("/projects");
  await page.getByRole("button", { name: `Excluir ${project}` }).click();
  await confirmDelete(page);
  await expect(page.getByRole("heading", { name: project })).toHaveCount(0);
});
