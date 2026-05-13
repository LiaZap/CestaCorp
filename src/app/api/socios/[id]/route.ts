import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

const PatchSchema = z.object({
  nome: z.string().min(2).optional(),
  cpf: z.string().min(11).optional(),
  email: z.string().email().optional().or(z.literal("")),
  telefone: z.string().optional().nullable(),
  profissao: z.string().optional().nullable(),
  estadoCivil: z.string().optional().nullable(),
  quotas: z.number().nonnegative().optional().nullable(),
  representanteLegal: z.boolean().optional(),
  assinante: z.boolean().optional(),
  dataNascimento: z.string().optional().nullable(),
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
  const d = parsed.data;

  const before = await prisma.socio.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "sócio não encontrado" }, { status: 404 });

  const updated = await prisma.socio.update({
    where: { id: params.id },
    data: {
      ...d,
      email: d.email === "" ? null : d.email,
      dataNascimento: d.dataNascimento === undefined
        ? undefined
        : d.dataNascimento
        ? new Date(d.dataNascimento)
        : null,
    },
  });

  await audit({
    session, action: "socio.update", resource: "cliente", resourceId: before.clienteId,
    before, after: updated, request: req,
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

  const socio = await prisma.socio.findUnique({ where: { id: params.id } });
  if (!socio) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  await prisma.socio.delete({ where: { id: params.id } });

  await audit({
    session, action: "socio.delete", resource: "cliente", resourceId: socio.clienteId,
    before: socio, request: req,
  });

  return NextResponse.json({ ok: true });
}
