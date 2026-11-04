import { confirmDelete, expect, login, test, unique } from "./fixtures";

// Runs only in the "mobile" project (Pixel 7): TCC requirement "responsive".
test("on a phone, the menu opens and the main pages work", async ({ page }) => {
  const project = unique("E2E Mobile");
  await login(page);

  await page.getByRole("button", { name: "Abrir ou fechar o menu" }).click();
  await page.getByRole("link", { name: "Projetos" }).first().click();
  await expect(page).toHaveURL(/\/projects$/);

  await page.goto("/projects/new");
  await page.getByLabel(/^Nome/).fill(project);
  await page.getByRole("button", { name: "Criar projeto" }).click();
  await expect(page.getByRole("heading", { name: project })).toBeVisible();

  // No horizontal scroll on the list
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: `Excluir ${project}` }).click();
  await confirmDelete(page);
  await expect(page.getByRole("heading", { name: project })).toHaveCount(0);
});
