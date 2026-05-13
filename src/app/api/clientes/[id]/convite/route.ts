import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { convidarClienteAcesso } from "@/lib/services/cliente-auth";

const Schema = z.object({
  email: z.string().email(),
  nome: z.string().min(2),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || (session.user as any).tipo !== "equipe") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await convidarClienteAcesso({
      clienteId: params.id,
      email: parsed.data.email,
      nome: parsed.data.nome,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || (session.user as any).tipo !== "equipe") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const acessos = await prisma.clienteAcesso.findMany({
    where: { clienteId: params.id },
    select: {
      id: true, email: true, nome: true, ativo: true,
      ultimoAcesso: true, tokenConvite: true, tokenConviteExpira: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(acessos);
}
