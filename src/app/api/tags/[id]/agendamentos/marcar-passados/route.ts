import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";

/**
 * Marca todos os agendamentos passados (data < hoje) e ainda pendentes
 * como já executados. Evita que o scheduler dispare lembretes retroativos
 * depois do import da V-106 (que traz cronograma 2023-2026).
 *
 * Patrick (24/05): "marca todos os passados como executado" — opção
 * sugerida durante a discussão da importação da V-106.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const textosDaTag = await prisma.tagTexto.findMany({
    where: { tagId: params.id },
    select: { id: true },
  });
  const textoIds = textosDaTag.map((t) => t.id);
  if (textoIds.length === 0) {
    return NextResponse.json({ ok: true, atualizados: 0 });
  }

  const r = await prisma.tagAgendamento.updateMany({
    where: {
      tagTextoId: { in: textoIds },
      executado: false,
      dataExecucao: { lt: hoje },
    },
    data: { executado: true, executadoEm: hoje },
  });

  await audit({
    session, action: "tagAgendamento.marcar-passados", resource: "tag",
    resourceId: params.id, after: { atualizados: r.count }, request: req,
  });

  return NextResponse.json({ ok: true, atualizados: r.count });
}
