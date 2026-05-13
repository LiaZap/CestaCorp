import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().max(200).optional(),
  cargo: z.string().max(80).nullable().optional(),
  telefone: z.string().max(30).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

/** GET /api/me — dados do usuário logado */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, email: true, name: true, role: true, active: true,
      cargo: true, telefone: true, avatarUrl: true,
      ultimoLogin: true, ultimoLoginIp: true, createdAt: true,
    },
  });
  if (!u) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(u);
}

/** PATCH /api/me — atualizar perfil próprio */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "dados inválidos", issues: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Se trocou email, precisa checar se já existe outro usuário
  if (data.email) {
    const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json({ error: "já existe outro usuário com este e-mail" }, { status: 409 });
    }
    data.email = data.email.toLowerCase();
  }

  const before = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, cargo: true, telefone: true, avatarUrl: true },
  });

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true, email: true, name: true, role: true,
      cargo: true, telefone: true, avatarUrl: true,
    },
  });

  await audit({
    session,
    action: "me.update",
    resource: "user",
    resourceId: session.user.id,
    before, after: data,
    request: req,
  });

  return NextResponse.json({ ok: true, user: updated });
}
