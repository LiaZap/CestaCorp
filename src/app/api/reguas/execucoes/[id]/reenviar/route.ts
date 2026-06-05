import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { processarExecucoesPendentes } from "@/lib/services/regua-cobranca";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";

/**
 * Reenvio: marca a execução como PENDENTE com agendamento = agora, preservando
 * o histórico anterior em `tentativas`. Dispara o processador imediatamente.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const exec = await prisma.execucaoRegua.findUnique({ where: { id: params.id } });
  if (!exec) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  // Antes de sobrescrever, arquiva a tentativa atual no histórico
  const tentativaAtual = {
    at: new Date().toISOString(),
    status: exec.status,
    enviadoEm: exec.enviadoEm?.toISOString() ?? null,
    erro: exec.erro ?? null,
    digisacMessageId: exec.digisacMessageId ?? null,
    requeuedBy: (session.user as any)?.email ?? "equipe",
  };

  const anteriores: any[] = Array.isArray(exec.tentativas) ? (exec.tentativas as any[]) : [];
  const novasTentativas = [...anteriores, tentativaAtual];

  await prisma.execucaoRegua.update({
    where: { id: params.id },
    data: {
      status: "PENDENTE",
      agendadoPara: new Date(),
      erro: null,
      enviadoEm: null,
      digisacMessageId: null,
      tentativas: novasTentativas as any,
    },
  });

  // Processa agora
  try {
    await processarExecucoesPendentes(5);
  } catch {
    // erro registrado na própria execução
  }

  return NextResponse.redirect(
    new URL(`/regua-cobranca/execucao/${params.id}?reenviado=1`, req.nextUrl.origin),
    303
  );
}
