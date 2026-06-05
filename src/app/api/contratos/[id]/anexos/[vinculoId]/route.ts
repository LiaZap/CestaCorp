import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

/**
 * DELETE /api/contratos/[id]/anexos/[vinculoId]
 *
 * Remove o vínculo de um anexo de um contrato (não deleta o anexo em si,
 * que é template reutilizável). Só equipe pode remover.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; vinculoId: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    assertEquipe(session);
  } catch (err) {
    if (err instanceof AuthorizationError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const vinculo = await prisma.contratoAnexoVinculo.findUnique({
    where: { id: params.vinculoId },
    include: { anexo: { select: { nome: true } } },
  });
  if (!vinculo || vinculo.contratoId !== params.id) {
    return NextResponse.json({ error: "vínculo não encontrado" }, { status: 404 });
  }

  await prisma.contratoAnexoVinculo.delete({ where: { id: params.vinculoId } });

  await audit({
    session,
    action: "contrato.remover-anexo",
    resource: "contrato",
    resourceId: params.id,
    before: { anexoNome: vinculo.anexo.nome },
    request: req,
  });

  return NextResponse.json({ ok: true });
}
