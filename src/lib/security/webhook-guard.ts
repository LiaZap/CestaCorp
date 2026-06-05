/**
 * Guard centralizado para webhooks de terceiros (NIBO, Digisac, Autentique).
 *
 * Cobre 3 problemas reportados pela auditoria de segurança:
 *  #3 — fail-open quando NODE_ENV=production mas secret está ausente.
 *       Agora se for produção e o secret não estiver setado, REJEITA.
 *  #4 — Autentique antes só validava HMAC se header existia. Agora se for
 *       produção e o handler exige assinatura, header ausente → 401.
 *  #5 — Sem idempotência. `registrarEvento` rejeita reprocessamento.
 *
 * Cada webhook chama `validarWebhook` no topo, e se passar, chama
 * `registrarEvento` antes de processar pra garantir dedup.
 */
import { NextRequest, NextResponse } from "next/server";
import { verificarHmac } from "@/lib/security/webhook-hmac";
import { prisma } from "@/lib/db/prisma";
import crypto from "node:crypto";

type Provider = "nibo" | "digisac" | "autentique";

/**
 * Valida assinatura HMAC do webhook.
 * Em produção, exige secret configurado E header de assinatura presente.
 * Em dev, aceita ausência do secret pra permitir teste local.
 *
 * Retorna `null` se OK, ou um NextResponse de erro.
 */
export function validarWebhook(opts: {
  provider: Provider;
  req: NextRequest;
  rawBody: string;
  secret: string | undefined;
  signature: string | null | undefined;
  prefixo?: string;
}): NextResponse | null {
  const { provider, secret, signature, rawBody, prefixo } = opts;

  if (process.env.NODE_ENV === "production") {
    // Em prod: secret obrigatório, header obrigatório.
    if (!secret) {
      // eslint-disable-next-line no-console
      console.error(`[webhook ${provider}] secret ausente em produção — rejeitando`);
      return NextResponse.json({ error: "webhook secret não configurado" }, { status: 503 });
    }
    if (!signature) {
      return NextResponse.json({ error: "assinatura ausente" }, { status: 401 });
    }
    const ok = verificarHmac({ body: rawBody, signature, secret, prefixo, permitirSemSecret: false });
    if (!ok) return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
    return null;
  }

  // Em dev: aceita sem secret (permite testar localmente). Se tiver secret
  // configurado, valida; mas se a request vier sem header, ignora a checagem.
  if (!secret) return null;
  if (!signature) return null;
  const ok = verificarHmac({ body: rawBody, signature, secret, prefixo, permitirSemSecret: true });
  if (!ok) return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });
  return null;
}

/**
 * Tenta registrar o evento na tabela WebhookEvent (unique [provider, eventId]).
 * Retorna `true` se é novo, `false` se já foi processado antes (replay/duplicata).
 *
 * Use no início do handler do webhook, ANTES de fazer qualquer side effect:
 *   const novo = await registrarEvento({ provider: "nibo", eventId, payload });
 *   if (!novo) return NextResponse.json({ ok: true, duplicado: true });
 */
export async function registrarEvento(opts: {
  provider: Provider;
  eventId: string;
  eventType?: string;
  payload?: unknown;
}): Promise<boolean> {
  const { provider, eventId, eventType } = opts;
  if (!eventId) {
    // Sem eventId não tem como deduplicar; deixa passar mas avisa.
    // eslint-disable-next-line no-console
    console.warn(`[webhook ${provider}] sem eventId — não dá pra deduplicar`);
    return true;
  }
  const payloadHash = opts.payload
    ? crypto.createHash("sha256").update(JSON.stringify(opts.payload)).digest("hex")
    : undefined;
  try {
    await prisma.webhookEvent.create({
      data: { provider, eventId, eventType, payloadHash },
    });
    return true;
  } catch (e: any) {
    // P2002 = unique constraint violation = duplicata
    if (e?.code === "P2002") return false;
    // Outros erros: re-lança pra handler tratar (será 500 com retry do provider).
    throw e;
  }
}
