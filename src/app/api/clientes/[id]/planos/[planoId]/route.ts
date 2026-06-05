import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";

const UpdateSchema = z.object({
  valorMensal: z.number().nonnegative().optional(),
  diaVencimento: z.number().int().min(1).max(31).optional().nullable(),
  observacao: z.string().max(1000).optional().nullable(),
});

const StatusSchema = z.object({
  acao: z.enum(["suspender", "ativar", "cancelar"]),
  motivo: z.string().max(1000).optional(),
});

interface Ctx { params: { id: string; planoId: string } }

async function carregar(planoId: string, clienteId: string) {
  return prisma.planoCliente.findFirst({
    where: { id: planoId, clienteId },
    include: { servico: true },
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const plano = await carregar(params.planoId, params.id);
  if (!plano) return NextResponse.json({ error: "plano não encontrado" }, { status: 404 });

  const body = await req.json();
  if ("acao" in body) {
    // Mudança de status
    const parsed = StatusSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    let novosDados: any = {};
    if (parsed.data.acao === "suspender") {
      if (plano.status !== "ATIVO") return NextResponse.json({ error: "Só dá pra suspender plano ATIVO" }, { status: 400 });
      novosDados = { status: "SUSPENSO", motivoCancelamento: parsed.data.motivo ?? null };
    } else if (parsed.data.acao === "ativar") {
      if (plano.status === "CANCELADO") return NextResponse.json({ error: "Plano cancelado não pode ser reativado — crie novo" }, { status: 400 });
      novosDados = { status: "ATIVO", motivoCancelamento: null };
    } else if (parsed.data.acao === "cancelar") {
      if (plano.status === "CANCELADO") return NextResponse.json({ error: "Plano já está cancelado" }, { status: 400 });
      novosDados = {
        status: "CANCELADO",
        dataCancelamento: new Date(),
        motivoCancelamento: parsed.data.motivo ?? "(sem motivo informado)",
      };
    }

    const atualizado = await prisma.planoCliente.update({
      where: { id: plano.id },
      data: novosDados,
      include: { servico: true },
    });

    await audit({
      session, action: `plano.${parsed.data.acao}`, resource: "cliente",
      resourceId: params.id,
      before: { status: plano.status },
      after: { status: atualizado.status, motivo: parsed.data.motivo },
      request: req,
    });

    return NextResponse.json(atualizado);
  }

  // Edição de campos
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const atualizado = await prisma.planoCliente.update({
    where: { id: plano.id },
    data: {
      valorMensal: parsed.data.valorMensal,
      diaVencimento: parsed.data.diaVencimento,
      observacao: parsed.data.observacao,
    },
    include: { servico: true },
  });

  await audit({
    session, action: "plano.update", resource: "cliente",
    resourceId: params.id,
    before: { valorMensal: plano.valorMensal, diaVencimento: plano.diaVencimento },
    after: { valorMensal: atualizado.valorMensal, diaVencimento: atualizado.diaVencimento },
    request: req,
  });

  return NextResponse.json(atualizado);
}
