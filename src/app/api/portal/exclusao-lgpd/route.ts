import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

const Schema = z.object({
  motivo: z.string().max(2000).optional(),
});

/**
 * Cliente solicita exclusão de seus dados (LGPD Art. 18 V).
 * Acessível APENAS pelo portal do cliente (não pela equipe).
 *
 * Cria uma solicitação em estado PENDENTE.
 * Equipe revisa em /configuracoes/lgpd e aprova/nega.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tipo = (session.user as any).tipo;
  const acessoId = session.user.id;
  const clienteId = (session.user as any).clienteId;

  if (tipo !== "cliente" || !clienteId) {
    return NextResponse.json({ error: "apenas clientes podem solicitar exclusão" }, { status: 403 });
  }

  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Verifica se já tem solicitação pendente
  const pendente = await prisma.solicitacaoExclusaoLgpd.findFirst({
    where: { clienteId, status: { in: ["PENDENTE", "APROVADA"] } },
  });
  if (pendente) {
    return NextResponse.json(
      { error: "já existe uma solicitação em andamento", solicitacaoId: pendente.id },
      { status: 409 }
    );
  }

  const solicitacao = await prisma.solicitacaoExclusaoLgpd.create({
    data: {
      acessoId,
      clienteId,
      motivo: parsed.data.motivo || null,
      status: "PENDENTE",
    },
  });

  await audit({
    session,
    action: "lgpd.solicitar-exclusao",
    resource: "cliente",
    resourceId: clienteId,
    after: { solicitacaoId: solicitacao.id, motivo: parsed.data.motivo },
    request: req,
  });

  return NextResponse.json({
    ok: true,
    solicitacaoId: solicitacao.id,
    status: solicitacao.status,
    mensagem: "Solicitação registrada. A equipe Cestacorp tem até 15 dias úteis pra revisar.",
  });
}

/** GET — cliente pode ver histórico das próprias solicitações */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const tipo = (session.user as any).tipo;
  const clienteId = (session.user as any).clienteId;
  if (tipo !== "cliente" || !clienteId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const lista = await prisma.solicitacaoExclusaoLgpd.findMany({
    where: { clienteId },
    orderBy: { solicitadoEm: "desc" },
    take: 10,
  });

  return NextResponse.json(lista);
}
