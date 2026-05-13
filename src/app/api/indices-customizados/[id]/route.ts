import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

const PatchSchema = z.object({
  nome: z.string().min(2).optional(),
  descricao: z.string().optional().nullable(),
  tipo: z.enum(["fixo", "tabela"]).optional(),
  valorFixo: z.number().optional().nullable(),
  valoresMensais: z.array(z.object({
    ano: z.number().int(),
    mes: z.number().int().min(1).max(12),
    valor: z.number(),
  })).optional(),
  fonte: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const before = await prisma.indiceCustomizado.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const updated = await prisma.indiceCustomizado.update({
    where: { id: params.id },
    data: parsed.data as any,
  });
  await audit({
    session, action: "indice.update", resource: "indice_customizado",
    resourceId: params.id, before, after: updated, request: req,
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  await prisma.indiceCustomizado.delete({ where: { id: params.id } });
  await audit({
    session, action: "indice.delete", resource: "indice_customizado",
    resourceId: params.id, request: req,
  });
  return NextResponse.json({ ok: true });
}
