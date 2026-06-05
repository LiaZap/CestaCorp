import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { audit } from "@/lib/security/audit";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const before = await prisma.cobranca.findUnique({ where: { id: params.id } });

  await prisma.$transaction(async (tx) => {
    await tx.cobranca.update({
      where: { id: params.id },
      data: { status: "PAGO", dataPagamento: new Date() },
    });
    await tx.execucaoRegua.updateMany({
      where: { cobrancaId: params.id, status: "PENDENTE" },
      data: { status: "PULADO", erro: `Cobrança marcada como paga manualmente por ${session.user?.email ?? "usuário"}` },
    });
  });

  await audit({
    session, action: "cobranca.marcar-paga", resource: "cobranca", resourceId: params.id,
    before, after: { ...before, status: "PAGO", dataPagamento: new Date() }, request: req,
  });

  return NextResponse.redirect(
    new URL(`/cobrancas/${params.id}`, req.nextUrl.origin),
    303
  );
}
