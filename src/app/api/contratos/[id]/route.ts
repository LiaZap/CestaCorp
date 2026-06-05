import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

const PatchSchema = z.object({
  clausulaComplementar: z.string().max(8000).optional(),
});

/**
 * PATCH /api/contratos/[id] — edição manual de campos do contrato.
 * Por ora só clausulaComplementar (página de detalhe).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    assertEquipe(session);
  } catch (err) {
    if (err instanceof AuthorizationError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const contrato = await prisma.contrato.findUnique({ where: { id: params.id } });
  if (!contrato || contrato.deletedAt)
    return NextResponse.json({ error: "contrato não encontrado" }, { status: 404 });

  const updated = await prisma.contrato.update({
    where: { id: params.id },
    data: {
      clausulaComplementar:
        parsed.data.clausulaComplementar !== undefined
          ? parsed.data.clausulaComplementar
          : undefined,
    },
  });

  await audit({
    session,
    action: "contrato.update",
    resource: "contrato",
    resourceId: params.id,
    before: { clausulaComplementar: contrato.clausulaComplementar },
    after: { clausulaComplementar: updated.clausulaComplementar },
    request: req,
  });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/contratos/[id] — soft-delete (status CANCELADO + deletedAt).
 * Não remove fisicamente. Honorários e cobranças permanecem para auditoria.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    assertEquipe(session);
  } catch (err) {
    if (err instanceof AuthorizationError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const contrato = await prisma.contrato.findUnique({ where: { id: params.id } });
  if (!contrato)
    return NextResponse.json({ error: "contrato não encontrado" }, { status: 404 });
  if (contrato.deletedAt)
    return NextResponse.json({ error: "contrato já cancelado" }, { status: 409 });

  await prisma.contrato.update({
    where: { id: params.id },
    data: {
      status: "CANCELADO",
      deletedAt: new Date(),
    },
  });

  await audit({
    session,
    action: "contrato.cancelar",
    resource: "contrato",
    resourceId: params.id,
    before: { status: contrato.status },
    after: { status: "CANCELADO", soft: true },
    request: req,
  });

  return NextResponse.json({ ok: true });
}
