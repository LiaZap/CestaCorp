import { test, expect } from "@playwright/test";

test.describe("Autenticação", () => {
  test("login equipe redireciona para dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@cestacorp.com.br");
    await page.fill('input[type="password"]', "Cestacorp@2026");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });

  test("credenciais inválidas mostram erro", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "admin@cestacorp.com.br");
    await page.fill('input[type="password"]', "senha-errada");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/E-mail ou senha inválidos/i)).toBeVisible();
  });

  test("/dashboard sem auth redireciona pra /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
