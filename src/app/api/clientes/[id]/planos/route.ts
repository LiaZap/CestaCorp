import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, assertOwnership, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";

const CreateSchema = z.object({
  servicoId: z.string().min(1),
  valorMensal: z.number().nonnegative(),
  diaVencimento: z.number().int().min(1).max(31).optional().nullable(),
  contratoId: z.string().optional().nullable(),
  observacao: z.string().max(1000).optional().nullable(),
  dataInicio: z.string().datetime().optional(),
  status: z.enum(["ATIVO", "SUSPENSO"]).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await assertOwnership(session, "cliente", params.id);
  } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const planos = await prisma.planoCliente.findMany({
    where: { clienteId: params.id },
    include: { servico: { select: { id: true, nome: true, categoria: true, slug: true } } },
    orderBy: [{ status: "asc" }, { dataInicio: "desc" }],
  });
  return NextResponse.json(planos);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const cliente = await prisma.cliente.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!cliente) return NextResponse.json({ error: "cliente não encontrado" }, { status: 404 });

  const servico = await prisma.catalogoServico.findUnique({ where: { id: parsed.data.servicoId }, select: { id: true } });
  if (!servico) return NextResponse.json({ error: "serviço não existe no catálogo" }, { status: 400 });

  // Evita duplicar plano ATIVO do mesmo serviço pro mesmo cliente
  const duplicado = await prisma.planoCliente.findFirst({
    where: { clienteId: params.id, servicoId: parsed.data.servicoId, status: "ATIVO" },
  });
  if (duplicado) {
    return NextResponse.json({ error: "Já existe plano ATIVO desse serviço pra esse cliente. Cancele o atual antes." }, { status: 409 });
  }

  const plano = await prisma.planoCliente.create({
    data: {
      clienteId: params.id,
      servicoId: parsed.data.servicoId,
      valorMensal: parsed.data.valorMensal,
      diaVencimento: parsed.data.diaVencimento ?? null,
      contratoId: parsed.data.contratoId || null,
      observacao: parsed.data.observacao || null,
      dataInicio: parsed.data.dataInicio ? new Date(parsed.data.dataInicio) : new Date(),
      status: parsed.data.status ?? "ATIVO",
    },
    include: { servico: true },
  });

  await audit({
    session, action: "plano.create", resource: "cliente",
    resourceId: params.id,
    after: { planoId: plano.id, servico: plano.servico.nome, valor: plano.valorMensal, status: plano.status },
    request: req,
  });

  return NextResponse.json(plano, { status: 201 });
}
