import { NextRequest, NextResponse } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { MessageLogModel } from "@/models/MessageLog";
import { extrairEventoWebhook, enviarMensagem } from "@/lib/services/digisac";
import { validarWebhook, registrarEvento } from "@/lib/security/webhook-guard";
import { responderCliente } from "@/lib/services/chatbot";
import { notificar } from "@/lib/services/notifications";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * Webhook DIGISAC — mensagens recebidas + atualizações de status.
 * Validação HMAC SHA256 (DIGISAC_WEBHOOK_SECRET) + idempotência.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature =
    req.headers.get("x-digisac-signature") ||
    req.headers.get("x-hub-signature-256") ||
    req.headers.get("x-signature");

  const erro = validarWebhook({
    provider: "digisac",
    req,
    rawBody,
    signature,
    secret: process.env.DIGISAC_WEBHOOK_SECRET,
    prefixo: "sha256=",
  });
  if (erro) return erro;

  try {
    const body = JSON.parse(rawBody);
    const evento = extrairEventoWebhook(body);

    // Idempotência: Digisac reenvia ack em caso de timeout.
    const msgIdRoot =
      evento?.payload?.data?.id ||
      evento?.payload?.messageId ||
      evento?.payload?.id ||
      body?.id;
    if (msgIdRoot) {
      const novo = await registrarEvento({
        provider: "digisac",
        eventId: `${evento?.tipo ?? "evt"}:${msgIdRoot}`,
        eventType: evento?.tipo,
        payload: body,
      });
      if (!novo) return NextResponse.json({ ok: true, duplicado: true });
    }

    await connectMongo();

    if (evento.tipo === "message") {
      const msg = evento.payload?.data ?? evento.payload;
      const direcao = msg?.isFromMe ? "OUT" : "IN";
      const telefone = msg?.contact?.number || msg?.number;
      const texto = String(msg?.text ?? "");

      const tel = telefone ? await prisma.contatoTelefone.findFirst({
        where: { numero: telefone }, select: { clienteId: true },
      }) : null;

      await MessageLogModel.create({
        canal: "WHATSAPP",
        direcao,
        clienteId: tel?.clienteId,
        para: telefone,
        de: msg?.user?.number,
        conteudo: texto,
        provider: "digisac",
        providerMessageId: msg?.id,
        providerPayload: msg,
        status: "RECEBIDO",
      });

      // Chatbot: responde mensagens IN automaticamente
      if (direcao === "IN" && texto && process.env.CHATBOT_ENABLED !== "false") {
        const bot = await responderCliente({
          clienteId: tel?.clienteId,
          telefone,
          texto,
        });
        if (bot.matched && bot.resposta) {
          // Grava o log SEMPRE (mesmo se Digisac falhar — útil pra debug/demo)
          let status: "ENVIADO" | "ERRO" = "ENVIADO";
          let providerMsgId = `bot-${Date.now()}`;
          try {
            const envio = await enviarMensagem({ number: telefone, text: bot.resposta });
            providerMsgId = envio?.id ?? providerMsgId;
          } catch (e) {
            status = "ERRO";
          }
          await MessageLogModel.create({
            canal: "WHATSAPP",
            direcao: "OUT",
            clienteId: tel?.clienteId,
            para: telefone,
            conteudo: bot.resposta,
            provider: "digisac",
            providerMessageId: providerMsgId,
            status,
          });
          if (bot.escalar) {
            await notificar({
              tipo: "FORM_RECEBIDO",
              titulo: `Cliente pediu atendente: ${telefone}`,
              descricao: `Intenção ${bot.intent} · "${texto.slice(0, 100)}"`,
              priority: "HIGH",
              clienteId: tel?.clienteId,
            });
          }
        }
      }
    } else if (evento.tipo === "status") {
      const statusMap: Record<string, string> = {
        "message.status.sent": "ENVIADO",
        "message.status.delivered": "ENTREGUE",
        "message.status.read": "LIDA",
        "message.status.error": "ERRO",
      };
      const novoStatus =
        statusMap[evento.payload?.event] ||
        statusMap[evento.payload?.type] ||
        "ENVIADO";
      const messageId =
        evento.payload?.messageId ||
        evento.payload?.data?.id ||
        evento.payload?.id;
      if (messageId) {
        await MessageLogModel.updateOne(
          { providerMessageId: messageId },
          { $set: { status: novoStatus } }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
