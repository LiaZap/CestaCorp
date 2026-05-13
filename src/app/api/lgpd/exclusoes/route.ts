import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/** Lista solicitações de exclusão LGPD (admin). */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const lista = await prisma.solicitacaoExclusaoLgpd.findMany({
    orderBy: [{ status: "asc" }, { solicitadoEm: "desc" }],
    include: {
      cliente: {
        select: { id: true, codigo: true, razaoSocial: true, cpfCnpj: true, status: true },
      },
    },
  });

  return NextResponse.json(lista);
}
