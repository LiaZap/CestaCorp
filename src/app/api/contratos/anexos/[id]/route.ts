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
  arquivoDocx: z.string().optional(),
  ordem: z.number().int().nonnegative().optional(),
  ativo: z.boolean().optional(),
  autoAplicarTags: z.array(z.string()).optional(),
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

  const before = await prisma.contratoAnexo.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const updated = await prisma.contratoAnexo.update({
    where: { id: params.id },
    data: parsed.data,
  });

  await audit({
    session, action: "contrato-anexo.update", resource: "contrato_anexo",
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

  await prisma.contratoAnexo.delete({ where: { id: params.id } });
  await audit({
    session, action: "contrato-anexo.delete", resource: "contrato_anexo",
    resourceId: params.id, request: req,
  });
  return NextResponse.json({ ok: true });
}
