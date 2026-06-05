import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";

const UpdateSchema = z.object({
  titulo: z.string().min(2).max(120).optional(),
  texto: z.string().min(2).max(4000).optional(),
  canal: z.enum(["whatsapp", "email", "sms"]).optional(),
});

interface Ctx { params: { id: string; textoId: string } }

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = UpdateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existente = await prisma.tagTexto.findUnique({ where: { id: params.textoId } });
  if (!existente || existente.tagId !== params.id) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }

  const atualizado = await prisma.tagTexto.update({
    where: { id: params.textoId },
    data: parsed.data,
  });

  await audit({
    session, action: "tagTexto.update", resource: "tag",
    resourceId: params.id, before: existente, after: atualizado, request: req,
  });

  return NextResponse.json(atualizado);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const existente = await prisma.tagTexto.findUnique({ where: { id: params.textoId } });
  if (!existente || existente.tagId !== params.id) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }

  // Limpa agendamentos vinculados primeiro (FK)
  await prisma.tagAgendamento.deleteMany({ where: { tagTextoId: params.textoId } });
  await prisma.tagTexto.delete({ where: { id: params.textoId } });

  await audit({
    session, action: "tagTexto.delete", resource: "tag",
    resourceId: params.id, before: existente, request: req,
  });

  return NextResponse.json({ ok: true });
}
