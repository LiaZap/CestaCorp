import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { connectMongo } from "@/lib/db/mongo";
import { MessageLogModel } from "@/models/MessageLog";
import { enviarMensagem, upsertContato } from "@/lib/services/digisac";

/**
 * Dispara uma mensagem ad-hoc de cobrança (sem passar pela régua).
 * Útil quando o operador quer mandar um lembrete pontual.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const cobranca = await prisma.cobranca.findUnique({
    where: { id: params.id },
    include: { cliente: { include: { telefones: true } } },
  });
  if (!cobranca) return NextResponse.json({ error: "cobrança não encontrada" }, { status: 404 });

  const tel = cobranca.cliente.telefones.find((t) => t.whatsapp && t.principal)
           ?? cobranca.cliente.telefones.find((t) => t.whatsapp)
           ?? cobranca.cliente.telefones[0];
  if (!tel) return NextResponse.json({ error: "cliente sem telefone" }, { status: 400 });

  const valor = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(cobranca.valor));
  const venc = cobranca.vencimento.toLocaleDateString("pt-BR");
  const texto = `Olá ${cobranca.cliente.razaoSocial}! Lembrete Cestacorp: seu boleto de ${valor} venceu em ${venc}.\n${cobranca.urlBoleto ? `Boleto: ${cobranca.urlBoleto}\n` : ""}${cobranca.pixCopiaCola ? `PIX: ${cobranca.pixCopiaCola}` : ""}`;

  try {
    let contactId = cobranca.cliente.digisacContactId;
    if (!contactId) {
      const c = await upsertContato({ name: cobranca.cliente.razaoSocial, number: tel.numero });
      contactId = c.id;
      await prisma.cliente.update({ where: { id: cobranca.cliente.id }, data: { digisacContactId: contactId } });
    }
    const envio = await enviarMensagem({ contactId, number: tel.numero, text: texto });

    await connectMongo();
    await MessageLogModel.create({
      canal: "WHATSAPP",
      direcao: "OUT",
      clienteId: cobranca.cliente.id,
      para: tel.numero,
      conteudo: texto,
      provider: "digisac",
      providerMessageId: envio.id,
      providerPayload: envio,
      status: "ENVIADO",
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }

  return NextResponse.redirect(
    new URL(`/cobrancas/${params.id}?sent=1`, process.env.NEXTAUTH_URL || "http://localhost:3000"),
    303
  );
}
