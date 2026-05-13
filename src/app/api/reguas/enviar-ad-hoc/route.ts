import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { connectMongo } from "@/lib/db/mongo";
import { MessageLogModel } from "@/models/MessageLog";
import { enviarMensagem, upsertContato } from "@/lib/services/digisac";
import { renderTemplate } from "@/lib/services/templating";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";

const Schema = z.object({
  clienteId: z.string(),
  cobrancaId: z.string().optional(),
  template: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Só equipe dispara mensagens ad-hoc (cliente não pode enviar msg em nome da Cestacorp)
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const cliente = await prisma.cliente.findUnique({
    where: { id: parsed.data.clienteId },
    include: {
      telefones: { where: { whatsapp: true } },
      cobrancas: parsed.data.cobrancaId
        ? { where: { id: parsed.data.cobrancaId }, take: 1 }
        : {
            where: { status: { in: ["ABERTO", "ATRASADO"] } },
            orderBy: { vencimento: "asc" },
            take: 1,
          },
    },
  });
  if (!cliente) return NextResponse.json({ error: "cliente não encontrado" }, { status: 404 });

  const tel = cliente.telefones.find((t) => t.principal) ?? cliente.telefones[0];
  if (!tel) return NextResponse.json({ error: "cliente sem telefone" }, { status: 400 });

  const cobranca = cliente.cobrancas[0];
  const mensagem = renderTemplate(parsed.data.template, {
    cliente,
    cobranca: cobranca ?? { descricao: "", valor: 0, vencimento: new Date() },
    hoje: new Date(),
  });

  try {
    let contactId = cliente.digisacContactId;
    if (!contactId) {
      const c = await upsertContato({ name: cliente.razaoSocial, number: tel.numero });
      contactId = c.id;
      await prisma.cliente.update({ where: { id: cliente.id }, data: { digisacContactId: contactId } });
    }
    const envio = await enviarMensagem({ contactId, number: tel.numero, text: mensagem });

    await connectMongo();
    await MessageLogModel.create({
      canal: "WHATSAPP",
      direcao: "OUT",
      clienteId: cliente.id,
      para: tel.numero,
      conteudo: mensagem,
      provider: "digisac",
      providerMessageId: envio.id,
      providerPayload: envio,
      status: "ENVIADO",
    });
    return NextResponse.json({ ok: true, providerMessageId: envio.id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
