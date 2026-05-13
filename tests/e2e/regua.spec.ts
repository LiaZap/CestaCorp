import { test, expect } from "@playwright/test";

async function login(page: any) {
  await page.goto("/login");
  await page.fill('input[type="email"]', "admin@cestacorp.com.br");
  await page.fill('input[type="password"]', "Cestacorp@2026");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
}

test.describe("Régua de Cobrança", () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test("página da régua mostra KPIs e heatmap", async ({ page }) => {
    await page.goto("/regua-cobranca");
    await expect(page.getByText(/Taxa de entrega/i)).toBeVisible();
    await expect(page.getByText(/Melhor momento para cobrar/i)).toBeVisible();
  });

  test("simulador abre e lista réguas", async ({ page }) => {
    await page.goto("/regua-cobranca/simular");
    await expect(page.getByText(/Simulador de envio/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Escolha régua/i })).toBeVisible();
  });

  test("lote abre com filtros", async ({ page }) => {
    await page.goto("/regua-cobranca/lote");
    await expect(page.getByText(/Envio em lote/i).first()).toBeVisible();
    await expect(page.getByText(/Template da mensagem/i)).toBeVisible();
  });

  test("chatbot via webhook Digisac responde", async ({ request }) => {
    const res = await request.post("/api/webhooks/digisac", {
      data: {
        event: "message.created",
        data: {
          id: `test-${Date.now()}`,
          text: "oi, bom dia",
          contact: { number: "+5551999000000" },
          isFromMe: false,
        },
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
