import { expect, login, test } from "./fixtures";

test.describe("Authentication", () => {
  test("protected pages redirect to /login and come back after signing in", async ({ page }) => {
    await page.goto("/projects");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();

    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("heading", { name: "Projetos", level: 2 }).first()).toBeVisible();
  });

  test("unknown URLs show the 404 page", async ({ page }) => {
    await login(page);
    await page.goto("/does-not-exist");
    await expect(page.getByText(/não encontrada/i).first()).toBeVisible();
  });
});
