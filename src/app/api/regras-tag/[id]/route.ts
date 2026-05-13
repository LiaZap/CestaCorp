import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const body = await req.json();
  const regra = await prisma.regraTag.update({
    where: { id: params.id },
    data: {
      ativa: typeof body.ativa === "boolean" ? body.ativa : undefined,
      nome: body.nome,
      params: body.params ?? undefined,
    },
  });
  return NextResponse.json(regra);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  await prisma.regraTag.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
