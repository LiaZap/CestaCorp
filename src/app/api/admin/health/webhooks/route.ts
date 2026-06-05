import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertAdmin, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";

/**
 * Health check dos 3 webhooks externos (NIBO/Digisac/Autentique).
 * Retorna, por provider:
 *   - secretConfigurado: bool (env presence)
 *   - tokenConfigurado:  bool (API token, pra envio outbound)
 *   - ultimoEvento:      Date | null (última batida recebida com sucesso)
 *   - totalUltimas24h:   number
 *   - totalTotal:        number
 *   - url:               URL pública do endpoint
 *
 * Usado pela UI /configuracoes/webhooks pra confirmar que rotação de secrets
 * deu certo sem precisar abrir curl/Postman.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertAdmin(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const base = process.env.NEXTAUTH_URL || "https://cestacorp.bahflash.tech";
  const desde24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const providers = [
    {
      key: "nibo",
      label: "NIBO",
      url: `${base}/api/webhooks/nibo`,
      secretEnv: "NIBO_WEBHOOK_SECRET",
      tokenEnv: "NIBO_TOKEN",
      eventos: ["invoice.paid", "invoice.created", "invoice.updated", "customer.updated"],
    },
    {
      key: "digisac",
      label: "Digisac",
      url: `${base}/api/webhooks/digisac`,
      secretEnv: "DIGISAC_WEBHOOK_SECRET",
      tokenEnv: "DIGISAC_TOKEN",
      eventos: ["message", "status"],
    },
    {
      key: "autentique",
      label: "Autentique",
      url: `${base}/api/webhooks/autentique`,
      secretEnv: "AUTENTIQUE_WEBHOOK_SECRET",
      tokenEnv: "AUTENTIQUE_TOKEN",
      eventos: ["document.signed", "document.rejected", "signature.viewed"],
    },
  ];

  const out = await Promise.all(providers.map(async (p) => {
    const [ultimoEvento, totalUltimas24h, totalTotal] = await Promise.all([
      prisma.webhookEvent.findFirst({
        where: { provider: p.key },
        orderBy: { processedAt: "desc" },
        select: { processedAt: true, eventType: true },
      }),
      prisma.webhookEvent.count({ where: { provider: p.key, processedAt: { gte: desde24h } } }),
      prisma.webhookEvent.count({ where: { provider: p.key } }),
    ]);

    const secretConfigurado = Boolean(process.env[p.secretEnv]);
    const tokenConfigurado = Boolean(process.env[p.tokenEnv]);

    // Status simples
    let status: "ok" | "atencao" | "erro" = "ok";
    if (!secretConfigurado) status = "erro";          // webhook bloqueado (503)
    else if (!ultimoEvento) status = "atencao";       // configurado mas nunca recebeu
    else if (ultimoEvento.processedAt < desde24h) status = "atencao"; // silencioso há 24h

    return {
      key: p.key,
      label: p.label,
      url: p.url,
      eventos: p.eventos,
      secretEnv: p.secretEnv,
      tokenEnv: p.tokenEnv,
      secretConfigurado,
      tokenConfigurado,
      ultimoEvento: ultimoEvento?.processedAt ?? null,
      ultimoEventoTipo: ultimoEvento?.eventType ?? null,
      totalUltimas24h,
      totalTotal,
      status,
    };
  }));

  return NextResponse.json({ providers: out, geradoEm: new Date().toISOString() });
}
