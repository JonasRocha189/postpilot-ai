import { expect, login, test } from "./fixtures";

test("best practices guide opens from the menu and switches networks", async ({ page }) => {
  await login(page);

  await page.getByRole("link", { name: "Boas práticas" }).first().click();
  await expect(page).toHaveURL(/\/best-practices$/);
  await expect(page.getByRole("heading", { name: "Boas práticas" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Instagram" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("cell", { name: /Carrossel/ })).toBeVisible();

  await page.getByRole("tab", { name: "LinkedIn" }).click();
  await expect(page).toHaveURL(/network=linkedin/);
  await expect(page.getByText("Carrossel (documento PDF)")).toBeVisible();
  await expect(page.getByText("3.000 caracteres")).toBeVisible();

  await page.getByRole("tab", { name: "X" }).click();
  await expect(page.getByText("280 caracteres")).toBeVisible();

  // The link to the agent's ideation mode keeps working
  await page.getByRole("link", { name: "Abrir o agente no modo Ideação" }).click();
  await expect(page).toHaveURL(/\/agent\?mode=ideation$/);
});
