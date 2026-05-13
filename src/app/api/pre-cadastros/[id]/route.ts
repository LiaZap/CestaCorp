import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

const PatchSchema = z.object({
  nomeContato: z.string().min(2).optional(),
  emailContato: z.string().email().optional(),
  telefoneContato: z.string().optional().nullable(),
  cpfContato: z.string().optional().nullable(),
  nomeEmpresaPretendido: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  regimePretendido: z.string().optional().nullable(),
  segmento: z.string().optional().nullable(),
  categoria: z.string().optional().nullable(),
  responsavelComercial: z.string().optional().nullable(),
  honorarioContabil: z.number().nonnegative().optional().nullable(),
  honorarioFolha: z.number().nonnegative().optional().nullable(),
  honorarioFiscal: z.number().nonnegative().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  temFolha: z.boolean().optional(),
  temFuncionario: z.boolean().optional(),
  temProlabore: z.boolean().optional(),
  status: z.enum(["PENDENTE", "EM_ABERTURA", "VIROU_CLIENTE", "DESISTIU"]).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const pre = await prisma.preCadastro.findUnique({ where: { id: params.id } });
  if (!pre) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json(pre);
}

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

  const before = await prisma.preCadastro.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const updated = await prisma.preCadastro.update({
    where: { id: params.id },
    data: {
      ...d,
      cnpj: d.cnpj === undefined ? undefined : (d.cnpj?.replace(/\D/g, "") || null),
      emailContato: d.emailContato?.toLowerCase(),
    },
  });

  await audit({
    session,
    action: "pre-cadastro.update",
    resource: "pre_cadastro",
    resourceId: params.id,
    before, after: updated,
    request: req,
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

  await prisma.preCadastro.delete({ where: { id: params.id } });
  await audit({
    session,
    action: "pre-cadastro.delete",
    resource: "pre_cadastro",
    resourceId: params.id,
    request: req,
  });
  return NextResponse.json({ ok: true });
}
