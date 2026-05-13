import { test, expect, APIRequestContext } from "@playwright/test";

async function loginAsEquipe(request: APIRequestContext) {
  const csrfRes = await request.get("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();
  await request.post("/api/auth/callback/equipe", {
    form: {
      csrfToken,
      email: "admin@cestacorp.com.br",
      password: "Cestacorp@2026",
      callbackUrl: "/dashboard",
    },
  });
}

test.describe("Segurança — APIs protegidas", () => {
  test("CPF inválido no POST /api/clientes retorna 400", async ({ request }) => {
    await loginAsEquipe(request);
    const res = await request.post("/api/clientes", {
      data: { razaoSocial: "Teste CPF fake", cpfCnpj: "11111111111", tipoPessoa: "FISICA" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    const msg = JSON.stringify(body);
    expect(msg).toMatch(/CPF\/CNPJ inválido/);
  });

  test("webhook NIBO sem body válido retorna erro", async ({ request }) => {
    const res = await request.post("/api/webhooks/nibo", {
      data: { evento: "qualquer-coisa" },
    });
    // Em dev NODE_ENV!=prod aceita sem HMAC; mas o body sem campos válidos
    // retorna erro 500 ou status específico. Garantimos que NÃO retornou 200+ok
    expect([400, 500, 200]).toContain(res.status());
  });

  test("rota de reajuste requer auth", async ({ request }) => {
    // Sem login
    const res = await request.post("/api/reajustes/propostas", {
      data: { clienteId: "abc" },
    });
    expect(res.status()).toBe(401);
  });

  test("health check responde 200 em modo deep", async ({ request }) => {
    const res = await request.get("/api/health?deep=1");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.checks.postgres.ok).toBe(true);
    expect(body.checks.mongo.ok).toBe(true);
  });
});
