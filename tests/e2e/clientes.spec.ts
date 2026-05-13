import { test, expect } from "@playwright/test";

async function login(page: any) {
  await page.goto("/login");
  await page.fill('input[type="email"]', "admin@cestacorp.com.br");
  await page.fill('input[type="password"]', "Cestacorp@2026");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
}

test.describe("Módulo Clientes", () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test("lista de clientes carrega com paginação", async ({ page }) => {
    await page.goto("/clientes");
    await expect(page.getByRole("heading", { name: /Clientes/i }).first()).toBeVisible();
    // Pagina 1 visível
    await expect(page.getByText(/Página/)).toBeVisible();
  });

  test("busca filtra por razão social", async ({ page }) => {
    await page.goto("/clientes");
    await page.fill('input[name="q"]', "TechNova");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/TechNova/i)).toBeVisible();
  });

  test("detalhe do cliente mostra timeline", async ({ page }) => {
    await page.goto("/clientes");
    await page.getByRole("link", { name: /TechNova/i }).first().click();
    await expect(page.getByRole("heading", { name: /Timeline/i })).toBeVisible();
  });
});
