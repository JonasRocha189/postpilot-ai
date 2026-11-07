import { confirmDelete, expect, login, PNG, test, todayBr, unique } from "./fixtures";

/**
 * Main acceptance flow of the first part of the app: project → subject →
 * image library → post with two variations (master-detail) → list filters →
 * calendar → edit the variations, then cleanup. Covers the TCC requirements
 * "CRUD of Project, Subject and Post" and "master-detail Post → Variations".
 */
test("content flow: project, subject, image, post, calendar", async ({ page }) => {
  // Long flow (create, filter, calendar, edit, cleanup): 3× the default timeout
  test.slow();
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

  await test.step("create a post with Instagram and LinkedIn variations", async () => {
    await page.goto("/posts/new");
    await page.getByLabel(/^Título/).fill(title);
    await page.getByLabel(/^Assunto/).selectOption({ label: subject });

    // Instagram (default variation): single image from the library, in review
    await expect(page.getByRole("checkbox", { name: /^Instagram/ })).toBeChecked();
    await expect(page.getByRole("radio", { name: /^Imagem única/ })).toBeChecked();
    await page.getByLabel(/^Status/).selectOption("review");
    // Calendar date field: typed as dd/mm/aaaa (a click on the calendar works too)
    await page.getByLabel("Data prevista").fill(todayBr());
    await page.getByLabel("Data prevista").press("Tab");
    await page.getByRole("textbox", { name: "Conteúdo" }).fill("Legenda curta para o Instagram.");
    await page.getByRole("button", { name: "Escolher", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Imagem 1" }).click();
    await expect(page.getByRole("button", { name: "Trocar imagem" })).toBeVisible();

    // LinkedIn: its own tab, text only, draft, same day
    await page.getByRole("checkbox", { name: /^LinkedIn/ }).check();
    await expect(page.getByRole("tab", { name: /^LinkedIn/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("textbox", { name: "Conteúdo" })).toHaveValue("");
    await page.getByRole("textbox", { name: "Conteúdo" }).fill("Texto mais longo, pensado para o LinkedIn.");
    await page.getByLabel("Data prevista").fill(todayBr());
    await page.getByLabel("Data prevista").press("Tab");

    await page.getByRole("button", { name: "Criar post" }).click();
    await expect(page).toHaveURL(/\/posts$/);
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toContainText(subject);
    await expect(row).toContainText("Instagram · Imagem única");
    await expect(row).toContainText("LinkedIn · Só texto");
    await expect(row).toContainText("Em revisão");
    await expect(row).toContainText("Rascunho");
  });

  await test.step("filter posts by status and network (URL + API)", async () => {
    // A post matches when one of its variations matches
    await page.getByLabel("Status").selectOption("review");
    await expect(page).toHaveURL(/status=review/);
    await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();

    await page.getByLabel("Status").selectOption("approved");
    await expect(page).toHaveURL(/status=approved/);
    await expect(page.getByText("Nenhum post com esses filtros.")).toBeVisible();
    // Wait for the cleared URL before the next filter (the router updates in a transition)
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(page).not.toHaveURL(/status=/);

    await page.getByLabel("Rede").selectOption("x");
    await expect(page).toHaveURL(/network=x/);
    await expect(page.getByText("Nenhum post com esses filtros.")).toBeVisible();
    await page.getByLabel("Rede").selectOption("linkedin");
    await expect(page).toHaveURL(/network=linkedin/);
    await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Limpar filtros" }).click();
    await expect(page).not.toHaveURL(/network=/);
    await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();
  });

  await test.step("each variation is on the calendar; open the Instagram one", async () => {
    await page.getByRole("link", { name: "Calendário" }).first().click();
    await expect(page).toHaveURL(/\/calendar$/);
    // Routes load lazily: wait for the calendar before clicking (the old page may still be on screen)
    await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible();
    const grid = page.getByRole("grid");
    await expect(grid.getByText(`${title} · LinkedIn`)).toBeVisible();
    await grid.getByText(`${title} · Instagram`).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(subject);
    await dialog.getByRole("link", { name: "Abrir post" }).click();
    await expect(page).toHaveURL(/\/posts\/[^/]+\?network=instagram$/);
    await expect(page.getByLabel(/^Título/)).toHaveValue(title);
    await expect(page.getByRole("tab", { name: /^Instagram/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByLabel("Data prevista")).toHaveValue(todayBr());
    await expect(page.getByRole("textbox", { name: "Conteúdo" })).toHaveValue("Legenda curta para o Instagram.");
  });

  await test.step("edit on the same screen: approve Instagram, remove LinkedIn", async () => {
    await page.getByLabel(/^Status/).selectOption("approved");
    await page.getByRole("checkbox", { name: /^LinkedIn/ }).uncheck();
    await expect(page.getByRole("tab", { name: /^LinkedIn/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Salvar alterações" }).click();

    await expect(page).toHaveURL(/\/posts$/);
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toContainText("Aprovado");
    await expect(row).not.toContainText("LinkedIn");
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
