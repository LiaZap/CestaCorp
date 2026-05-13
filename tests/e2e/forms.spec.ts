import { test, expect } from "@playwright/test";

test.describe("Formulários públicos", () => {
  test("lista de formulários carrega sem login", async ({ page }) => {
    await page.goto("/forms");
    await expect(page.getByRole("heading", { name: /Formulários/i })).toBeVisible();
    await expect(page.getByText(/Abertura de Empresa/i)).toBeVisible();
  });

  test("form específico carrega com renderer", async ({ page }) => {
    await page.goto("/forms/abertura-empresa");
    await expect(page.getByText(/Abertura de Empresa/i).first()).toBeVisible();
  });

  test("submit com campos obrigatórios faltando retorna erros detalhados", async ({ request }) => {
    const res = await request.post("/api/forms/abertura-mei/responses", {
      data: {
        autor: { nome: "Teste", email: "teste@example.com" },
        answers: {}, // todos os obrigatórios vazios
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validação falhou");
    expect(Array.isArray(body.campos)).toBe(true);
    expect(body.campos.length).toBeGreaterThan(0);
  });

  test("submit com CPF inválido falha na validação", async ({ request }) => {
    const res = await request.post("/api/forms/abertura-mei/responses", {
      data: {
        autor: { nome: "Teste", email: "teste@example.com" },
        answers: { cpf: "11111111111" },
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    const msgs = (body.campos as any[]).map((c) => c.message).join(" ");
    expect(msgs).toMatch(/CPF inválido/i);
  });
});
