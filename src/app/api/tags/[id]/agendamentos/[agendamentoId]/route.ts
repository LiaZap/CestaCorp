import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";

const PatchSchema = z.object({
  acao: z.enum(["marcar-executado", "marcar-pendente", "cancelar"]),
});

interface Ctx { params: { id: string; agendamentoId: string } }

/**
 * Ações no agendamento: marcar como já executado (suprime envio),
 * voltar pra pendente, ou apagar.
 * Usado especialmente pra "marcar todos os passados como executado" depois
 * de importar a V-106 (datas históricas 2023-2025).
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const ag = await prisma.tagAgendamento.findUnique({ where: { id: params.agendamentoId } });
  if (!ag) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  if (parsed.data.acao === "cancelar") {
    await prisma.tagAgendamento.delete({ where: { id: params.agendamentoId } });
    return NextResponse.json({ ok: true, removido: true });
  }

  const atualizado = await prisma.tagAgendamento.update({
    where: { id: params.agendamentoId },
    data: {
      executado: parsed.data.acao === "marcar-executado",
      executadoEm: parsed.data.acao === "marcar-executado" ? new Date() : null,
      erro: null,
    },
  });
  return NextResponse.json(atualizado);
}
