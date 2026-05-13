import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { obterContaReceber } from "@/lib/services/nibo";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const c = await prisma.cobranca.findUnique({ where: { id: params.id } });
  if (!c || !c.niboDebitId) return NextResponse.json({ error: "cobrança sem niboDebitId" }, { status: 400 });

  try {
    const r = await obterContaReceber(c.niboDebitId);
    await prisma.cobranca.update({
      where: { id: params.id },
      data: {
        descricao: r.description,
        valor: r.value,
        vencimento: new Date(r.dueDate),
        dataPagamento: r.paymentDate ? new Date(r.paymentDate) : null,
        linhaDigitavel: r.digitableLine,
        urlBoleto: r.billetUrl,
        pixCopiaCola: r.pixCopyPaste,
        status: r.isPaid ? "PAGO" : c.status,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }

  return NextResponse.redirect(
    new URL(`/cobrancas/${params.id}?sync=1`, process.env.NEXTAUTH_URL || "http://localhost:3000"),
    303
  );
}
