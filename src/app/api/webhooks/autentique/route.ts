import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sincronizarStatusAutentique } from "@/lib/services/assinatura";
import { audit } from "@/lib/security/audit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * Webhook Autentique.
 *
 * O painel da Autentique permite configurar uma URL pra receber notificações
 * de eventos: signed, rejected, viewed, etc.
 *
 * Configure: https://www.autentique.com.br → Configurações → Webhooks
 *   URL: https://seu-dominio.com.br/api/webhooks/autentique
 *   (opcional) Secret: AUTENTIQUE_WEBHOOK_SECRET no .env
 *
 * Payload típico:
 *   {
 *     "event": { "type": "document.signed" | "document.rejected" | "signature.viewed" },
 *     "document": { "id": "...", "name": "...", ... }
 *   }
 *
 * O evento traz só a referência; chamamos sincronizarStatusAutentique() pra
 * buscar a verdade da fonte (não confiar 100% no payload).
 */
export async function POST(req: NextRequest) {
  const body = await req.text();

  // Validação opcional de assinatura (se Autentique fornecer header)
  const secret = process.env.AUTENTIQUE_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers.get("x-autentique-signature");
    if (sig) {
      const crypto = await import("node:crypto");
      const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
      if (sig !== expected && sig !== `sha256=${expected}`) {
        logger.warn("Autentique webhook: assinatura inválida");
        return NextResponse.json({ error: "invalid signature" }, { status: 401 });
      }
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const eventType = payload?.event?.type ?? payload?.type ?? "unknown";
  const documentId = payload?.document?.id ?? payload?.documentId;

  if (!documentId) {
    logger.warn("Autentique webhook sem documentId", { payload });
    return NextResponse.json({ error: "documentId ausente" }, { status: 400 });
  }

  // Localiza contrato pelo docId
  const contrato = await prisma.contrato.findFirst({
    where: { assinaturaDocId: documentId, assinaturaProvider: "autentique" },
    select: { id: true, numero: true, clienteId: true },
  });

  if (!contrato) {
    logger.info("Autentique webhook: documento sem contrato vinculado", { documentId, eventType });
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Sincroniza status ativo (busca a verdade da Autentique)
  try {
    const result = await sincronizarStatusAutentique(contrato.id);

    await audit({
      session: null,
      action: `autentique.webhook.${eventType}`,
      resource: "contrato",
      resourceId: contrato.id,
      after: { documentId, eventType, status: result.status },
      request: req,
    });

    logger.info("Autentique webhook processado", {
      eventType, documentId, contratoId: contrato.id, status: result.status,
    });

    return NextResponse.json({ ok: true, status: result.status });
  } catch (err: any) {
    logger.error("Autentique webhook erro ao sincronizar", {
      err: String(err?.message ?? err), documentId, contratoId: contrato.id,
    });
    return NextResponse.json({ error: "sync-failed" }, { status: 500 });
  }
}

/**
 * GET — health check / verificação de URL pelo painel da Autentique
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "autentique-webhook",
    configured: Boolean(process.env.AUTENTIQUE_TOKEN),
  });
}
