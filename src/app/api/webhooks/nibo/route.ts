import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { obterContaReceber } from "@/lib/services/nibo";
import { notificar } from "@/lib/services/notifications";
import { validarWebhook, registrarEvento } from "@/lib/security/webhook-guard";

export const runtime = "nodejs";

/**
 * Webhook NIBO — recebe eventos de pagamento de contas a receber.
 * Validação HMAC SHA256 obrigatória em produção (NIBO_WEBHOOK_SECRET).
 * Idempotente: replay do mesmo evento (auditoria #5) é ignorado.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature =
    req.headers.get("x-hub-signature-256") ||
    req.headers.get("x-nibo-signature") ||
    req.headers.get("x-signature");

  const erro = validarWebhook({
    provider: "nibo",
    req,
    rawBody,
    signature,
    secret: process.env.NIBO_WEBHOOK_SECRET,
    prefixo: "sha256=",
  });
  if (erro) return erro;

  try {
    const body = JSON.parse(rawBody);

    const eventId =
      body?.id || body?.data?.id || body?.scheduleId || body?.receivableId;
    if (!eventId) return NextResponse.json({ ok: true, skipped: true });

    // Idempotência: NIBO pode reenviar o mesmo evento se nosso 200 demorar.
    const novo = await registrarEvento({
      provider: "nibo",
      eventId: String(eventId),
      eventType: body?.event ?? body?.type,
      payload: body,
    });
    if (!novo) {
      return NextResponse.json({ ok: true, duplicado: true });
    }

    const receivable = await obterContaReceber(eventId);
    const cobranca = await prisma.cobranca.findUnique({
      where: { niboDebitId: receivable.id },
    });
    if (!cobranca) return NextResponse.json({ ok: true, skipped: "cobrança não encontrada" });

    const wasPaid = cobranca.status === "PAGO";
    const isPaid = receivable.isPaid;

    await prisma.cobranca.update({
      where: { id: cobranca.id },
      data: {
        status: isPaid ? "PAGO" : cobranca.status,
        dataPagamento: receivable.paymentDate ? new Date(receivable.paymentDate) : null,
      },
    });

    if (!wasPaid && isPaid) {
      await prisma.execucaoRegua.updateMany({
        where: { cobrancaId: cobranca.id, status: "PENDENTE" },
        data: { status: "PULADO", erro: "Pagamento confirmado via webhook NIBO" },
      });
      const cli = await prisma.cliente.findUnique({
        where: { id: cobranca.clienteId },
        select: { razaoSocial: true },
      });
      await notificar({
        tipo: "COBRANCA_PAGA",
        titulo: `Pagamento recebido: ${cli?.razaoSocial ?? ""}`,
        descricao: `${cobranca.descricao ?? ""} — R$ ${Number(cobranca.valor).toFixed(2)}`,
        href: `/cobrancas/${cobranca.id}`,
        clienteId: cobranca.clienteId,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
