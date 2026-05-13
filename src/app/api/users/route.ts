import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { assertAdmin, AuthorizationError } from "@/lib/security/ownership";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

const UserSchema = z.object({
  nome: z.string().min(2).max(120),
  email: z.string().email(),
  role: z.enum(["ADMIN", "GESTOR", "OPERADOR"]).default("OPERADOR"),
  active: z.boolean().default(true),
  senha: z.string().min(8).optional(),
  cargo: z.string().max(80).optional(),
  telefone: z.string().max(30).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertAdmin(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true, email: true, name: true, role: true, active: true,
      cargo: true, telefone: true, createdAt: true,
    },
  });
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertAdmin(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = UserSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  const senha = d.senha ?? `Cestacorp@${Math.floor(Math.random() * 10000)}`;
  const hash = await bcrypt.hash(senha, 10);

  try {
    const user = await prisma.user.create({
      data: {
        name: d.nome,
        email: d.email.toLowerCase(),
        role: d.role as any,
        active: d.active,
        password: hash,
        cargo: d.cargo || null,
        telefone: d.telefone || null,
      },
      select: { id: true, email: true, name: true, role: true },
    });
    await audit({ session, action: "user.create", resource: "user", resourceId: user.id, after: user, request: req });
    return NextResponse.json({ ok: true, user, senhaInicial: d.senha ? undefined : senha });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "E-mail já cadastrado" }, { status: 409 });
    }
    throw err;
  }
}
