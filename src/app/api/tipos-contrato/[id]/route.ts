import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { audit } from "@/lib/security/audit";

const Body = z.object({
  nome: z.string().min(2).optional(),
  descricao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
  ordem: z.number().int().optional(),
  exigeOriginal: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); }
  catch (e) { return NextResponse.json({ error: (e as AuthorizationError).message }, { status: 403 }); }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const before = await prisma.tipoContrato.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const after = await prisma.tipoContrato.update({ where: { id: params.id }, data: parsed.data });
  await audit({
    session, action: "tipo-contrato.update", resource: "tipo_contrato",
    resourceId: params.id, before, after, request: req,
  });
  return NextResponse.json(after);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); }
  catch (e) { return NextResponse.json({ error: (e as AuthorizationError).message }, { status: 403 }); }

  // Se está em uso por algum template, soft-delete via ativo=false em vez de deletar
  const tipo = await prisma.tipoContrato.findUnique({
    where: { id: params.id },
    include: { _count: { select: { templates: true } } },
  });
  if (!tipo) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  if (tipo._count.templates > 0) {
    const after = await prisma.tipoContrato.update({ where: { id: params.id }, data: { ativo: false } });
    await audit({
      session, action: "tipo-contrato.desativar", resource: "tipo_contrato",
      resourceId: params.id, before: tipo, after, request: req,
    });
    return NextResponse.json({ ok: true, soft: true, motivo: `${tipo._count.templates} templates ainda usam esse tipo` });
  }

  await prisma.tipoContrato.delete({ where: { id: params.id } });
  await audit({
    session, action: "tipo-contrato.delete", resource: "tipo_contrato",
    resourceId: params.id, before: tipo, request: req,
  });
  return NextResponse.json({ ok: true, soft: false });
}
