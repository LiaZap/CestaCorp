import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { connectMongo } from "@/lib/db/mongo";
import { MessageLogModel } from "@/models/MessageLog";
import { enviarMensagem, upsertContato } from "@/lib/services/digisac";
import { enviarEmail } from "@/lib/services/email";
import { renderTemplate } from "@/lib/services/templating";

const Schema = z.object({
  clienteId: z.string(),
  passoId: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [cliente, passo] = await Promise.all([
    prisma.cliente.findUnique({
      where: { id: parsed.data.clienteId },
      include: {
        telefones: { where: { whatsapp: true } },
        emails: { where: { principal: true }, take: 1 },
        cobrancas: {
          where: { status: { in: ["ABERTO", "ATRASADO"] } },
          orderBy: { vencimento: "asc" },
          take: 1,
        },
      },
    }),
    prisma.reguaPasso.findUnique({ where: { id: parsed.data.passoId } }),
  ]);

  if (!cliente || !passo) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const cobranca = cliente.cobrancas[0];
  const ctx = {
    cliente,
    cobranca: cobranca ?? {
      descricao: "Honorários (exemplo)",
      valor: 1500,
      vencimento: new Date(),
      linhaDigitavel: "",
      urlBoleto: "",
      pixCopiaCola: "",
    },
    hoje: new Date(),
  };
  const mensagem = renderTemplate(passo.templateMsg, ctx);

  try {
    if (passo.canal === "WHATSAPP") {
      const tel = cliente.telefones.find((t) => t.principal) ?? cliente.telefones[0];
      if (!tel) throw new Error("Cliente sem telefone WhatsApp");

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
    }

    if (passo.canal === "EMAIL") {
      const email = cliente.emails[0]?.email;
      if (!email) throw new Error("Cliente sem e-mail");
      const envio = await enviarEmail({
        to: email,
        subject: `Cestacorp — ${passo.nome}`,
        text: mensagem,
        html: mensagem.replace(/\n/g, "<br/>"),
      });
      await connectMongo();
      await MessageLogModel.create({
        canal: "EMAIL",
        direcao: "OUT",
        clienteId: cliente.id,
        para: email,
        assunto: `Cestacorp — ${passo.nome}`,
        conteudo: mensagem,
        provider: "smtp",
        providerMessageId: envio.id,
        status: envio.simulated ? "ENVIANDO" : "ENVIADO",
      });
      return NextResponse.json({ ok: true, simulated: envio.simulated });
    }

    return NextResponse.json({ error: `canal ${passo.canal} não suportado` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
