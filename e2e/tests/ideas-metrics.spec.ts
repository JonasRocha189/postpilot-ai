import { confirmDelete, expect, login, test, today, todayBr, unique } from "./fixtures";

/**
 * Idea → post → metrics: an idea becomes a post (form filled in from it), the
 * LinkedIn variation is published, and a LinkedIn CSV export is imported and
 * matched to that variation by the publish date.
 */
test("idea becomes a post, then its LinkedIn metrics are imported", async ({ page }) => {
  test.slow();
  const project = unique("E2E Ideias");
  const subject = unique("E2E Assunto");
  const idea = unique("E2E Ideia");

  await login(page);
  await page.goto("/projects/new");
  await page.getByLabel(/^Nome/).fill(project);
  await page.getByRole("button", { name: "Criar projeto" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await page.goto("/subjects/new");
  await page.getByLabel(/^Nome/).fill(subject);
  await page.getByRole("button", { name: "Criar assunto" }).click();
  await expect(page).toHaveURL(/\/subjects$/);

  await test.step("write down an idea for LinkedIn", async () => {
    await page.getByRole("link", { name: "Ideias" }).first().click();
    await expect(page.getByRole("heading", { name: "Ideias", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Nova ideia" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/^Título/).fill(idea);
    await dialog.getByLabel("Anotações").fill("Ângulo: custos para PMEs.");
    await dialog.getByLabel("Assunto").selectOption({ label: subject });
    await dialog.getByRole("checkbox", { name: "LinkedIn" }).check();
    await dialog.getByRole("button", { name: "Criar ideia" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: idea })).toBeVisible();
  });

  await test.step("create the post from the idea and publish it on LinkedIn", async () => {
    await page.getByRole("link", { name: `Criar post a partir de ${idea}` }).click();
    await expect(page.getByLabel(/^Título/)).toHaveValue(idea);
    await expect(page.getByLabel(/^Assunto/)).toHaveValue(/.+/);
    await expect(page.getByRole("checkbox", { name: /^LinkedIn/ })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /^Instagram/ })).not.toBeChecked();

    await page.getByRole("textbox", { name: "Conteúdo" }).fill("Texto para o LinkedIn.");
    await page.getByLabel(/^Status/).selectOption("published");
    await page.getByLabel("Data prevista").fill(todayBr());
    await page.getByLabel("Data prevista").press("Tab");
    await page.getByRole("button", { name: "Criar post" }).click();
    await expect(page).toHaveURL(/\/posts$/);
    await expect(page.getByRole("row").filter({ hasText: idea })).toContainText("Publicado");
  });

  await test.step("the idea moved to “Viraram post”", async () => {
    await page.goto("/ideas");
    await expect(page.getByText("Nenhuma ideia aberta. Anote a próxima!")).toBeVisible();
    await page.getByRole("button", { name: "Viraram post" }).click();
    const card = page.getByRole("listitem").filter({ hasText: idea });
    await expect(card).toContainText("Virou post");
    await expect(card.getByRole("link", { name: "Abrir post" })).toBeVisible();
  });

  await test.step("import a LinkedIn CSV: the row is matched to the post by date", async () => {
    await page.getByRole("link", { name: "Métricas" }).first().click();
    await expect(page.getByRole("heading", { name: "Métricas", exact: true })).toBeVisible();
    const csv = `created date,post title,impressions,reactions,comments,reposts,clicks\n${today()},${idea},"1,250",40,6,3,18\n`;
    await page.getByLabel("Arquivo CSV do LinkedIn").setInputFiles({
      name: "linkedin.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });

    await expect(page.getByText(/1 linhas, 1 prontas para importar, 0 com erro/)).toBeVisible();
    const match = page.getByRole("combobox", { name: "Post do PostPilot da linha 2" });
    await expect(match.locator("option:checked")).toHaveText(new RegExp(`^${idea}`));
    await expect(page.getByRole("cell", { name: "1.250" })).toBeVisible();

    await page.getByRole("button", { name: "Importar 1 linha" }).click();
    await expect(page.getByText("1 registro de métricas importado.")).toBeVisible();
  });

  await test.step("cleanup: post, idea, subject and project", async () => {
    await page.goto("/posts");
    await page.getByRole("button", { name: `Excluir ${idea}` }).click();
    await confirmDelete(page);
    await expect(page.getByRole("link", { name: idea, exact: true })).toHaveCount(0);

    await page.goto("/ideas?show=all");
    await page.getByRole("button", { name: `Excluir ${idea}` }).click();
    await confirmDelete(page);
    await expect(page.getByRole("heading", { name: idea })).toHaveCount(0);

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
