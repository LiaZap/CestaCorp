import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";

/**
 * Lista TagTextos disponíveis pra escolher como mensagem da obrigação (#99).
 * Agrupa por Tag pra UI poder mostrar select agrupado.
 */
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const tags = await prisma.tag.findMany({
    select: {
      id: true, nome: true, slug: true, cor: true, categoria: true,
      textos: {
        select: { id: true, titulo: true, canal: true },
        orderBy: { titulo: "asc" },
      },
    },
    where: { textos: { some: {} } },
    orderBy: [{ categoria: "asc" }, { nome: "asc" }],
  });

  return NextResponse.json(tags);
}
