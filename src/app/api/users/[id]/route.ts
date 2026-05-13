import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { assertAdmin, AuthorizationError } from "@/lib/security/ownership";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

/** GET /api/users/[id] — dados completos de um usuário (só ADMIN) */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertAdmin(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const u = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, email: true, name: true, role: true, active: true,
      cargo: true, telefone: true, avatarUrl: true,
      ultimoLogin: true, ultimoLoginIp: true, loginFailures: true,
      createdAt: true, updatedAt: true,
    },
  });
  if (!u) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json(u);
}

const PatchSchema = z.object({
  nome: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  role: z.enum(["ADMIN", "GESTOR", "OPERADOR"]).optional(),
  active: z.boolean().optional(),
  cargo: z.string().max(80).nullable().optional(),
  telefone: z.string().max(30).nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertAdmin(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const before = await prisma.user.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  // Evita o admin desativar a si mesmo
  if ((session.user as any).id === params.id && parsed.data.active === false) {
    return NextResponse.json({ error: "você não pode desativar a si mesmo" }, { status: 400 });
  }

  // Se trocou email, checar duplicidade
  if (parsed.data.email && parsed.data.email.toLowerCase() !== before.email) {
    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });
    if (existing && existing.id !== params.id) {
      return NextResponse.json({ error: "já existe usuário com este e-mail" }, { status: 409 });
    }
  }

  const after = await prisma.user.update({
    where: { id: params.id },
    data: {
      name: parsed.data.nome,
      email: parsed.data.email?.toLowerCase(),
      role: parsed.data.role as any,
      active: parsed.data.active,
      cargo: parsed.data.cargo,
      telefone: parsed.data.telefone,
    },
    select: { id: true, email: true, name: true, role: true, active: true, cargo: true, telefone: true },
  });
  await audit({ session, action: "user.update", resource: "user", resourceId: params.id, before, after, request: req });
  return NextResponse.json(after);
}

const ResetSchema = z.object({ novaSenha: z.string().min(8).optional() });

/**
 * POST /api/users/[id] com body { action: "reset-senha" } → gera nova senha aleatória
 * e retorna a senha no response (admin deve anotar e passar ao usuário).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertAdmin(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const body = await req.json().catch(() => ({}));
  if (body?.action !== "reset-senha") return NextResponse.json({ error: "ação desconhecida" }, { status: 400 });

  const parsed = ResetSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const senha = parsed.data.novaSenha ?? `Cestacorp@${Math.floor(Math.random() * 10000)}`;
  const hash = await bcrypt.hash(senha, 10);
  await prisma.user.update({ where: { id: params.id }, data: { password: hash } });
  await audit({ session, action: "user.reset-senha", resource: "user", resourceId: params.id, request: req });

  return NextResponse.json({ ok: true, senha: parsed.data.novaSenha ? undefined : senha });
}
