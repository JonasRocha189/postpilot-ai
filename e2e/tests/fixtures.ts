import { expect, test as base, type Page } from "@playwright/test";

/** 1x1 transparent PNG, used for uploads. */
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/** Today as YYYY-MM-DD in the same timezone as the browser (config: America/Sao_Paulo). */
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/** Today as shown by the date field in pt-BR (dd/mm/aaaa). */
export function todayBr(): string {
  const [y, m, d] = today().split("-");
  return `${d}/${m}/${y}`;
}

/** Unique names, so runs never collide with old data (mock or real API). */
export function unique(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}`;
}

/**
 * Logs in through /login. Without Auth0 configured (mock and local full
 * stack), "Entrar" starts the development session.
 */
export async function login(page: Page, path = "/dashboard") {
  await page.goto(path);
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

/** Confirms the delete dialog (and returns it, to check messages). */
export async function confirmDelete(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Excluir" }).click();
  return dialog;
}

export const test = base;
export { expect };
