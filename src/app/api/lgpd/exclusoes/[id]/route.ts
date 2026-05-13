import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

const Schema = z.object({
  acao: z.enum(["aprovar", "negar", "executar"]),
  decisao: z.string().max(2000).optional(),
});

/**
 * Equipe responde a uma solicitação de exclusão LGPD.
 *
 * Fluxo:
 *   PENDENTE → APROVADA (decisão = motivo da aprovação)
 *   PENDENTE → NEGADA (decisão = justificativa)
 *   APROVADA → EXECUTADA (anonimização realizada)
 *
 * Anonimização (ao executar): substitui dados pessoais por valores neutros,
 * mantendo o registro pra auditoria. Não deleta cliente nem cobrança fechada.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const sol = await prisma.solicitacaoExclusaoLgpd.findUnique({
    where: { id: params.id },
    include: { cliente: { select: { id: true, razaoSocial: true } } },
  });
  if (!sol) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const userId = session.user.id;
  let updated;

  if (parsed.data.acao === "aprovar") {
    if (sol.status !== "PENDENTE") {
      return NextResponse.json({ error: "só solicitações PENDENTE podem ser aprovadas" }, { status: 400 });
    }
    updated = await prisma.solicitacaoExclusaoLgpd.update({
      where: { id: params.id },
      data: {
        status: "APROVADA",
        revisadoEm: new Date(),
        revisadoPor: userId,
        decisao: parsed.data.decisao || null,
      },
    });
  } else if (parsed.data.acao === "negar") {
    if (sol.status !== "PENDENTE") {
      return NextResponse.json({ error: "só solicitações PENDENTE podem ser negadas" }, { status: 400 });
    }
    if (!parsed.data.decisao) {
      return NextResponse.json({ error: "negação exige justificativa" }, { status: 400 });
    }
    updated = await prisma.solicitacaoExclusaoLgpd.update({
      where: { id: params.id },
      data: {
        status: "NEGADA",
        revisadoEm: new Date(),
        revisadoPor: userId,
        decisao: parsed.data.decisao,
      },
    });
  } else {
    // executar
    if (sol.status !== "APROVADA") {
      return NextResponse.json({ error: "só APROVADA pode ser executada" }, { status: 400 });
    }

    // Anonimização do cliente (não delete físico — preserva auditoria)
    const sufixo = sol.id.slice(-6).toUpperCase();
    await prisma.$transaction(async (tx) => {
      await tx.cliente.update({
        where: { id: sol.clienteId },
        data: {
          razaoSocial: `[ANONIMIZADO-${sufixo}]`,
          nomeFantasia: null,
          status: "ENCERRADO",
          cpfCnpj: `00000000000000-${sufixo}`, // placeholder único
          digisacContactId: null,
          niboCustomerId: null,
          whatsappGrupoId: null,
          whatsappGrupoNome: null,
        },
      });
      // Apaga emails/telefones (PII)
      await tx.contatoEmail.deleteMany({ where: { clienteId: sol.clienteId } });
      await tx.contatoTelefone.deleteMany({ where: { clienteId: sol.clienteId } });
      // Anonimiza sócios
      await tx.socio.updateMany({
        where: { clienteId: sol.clienteId },
        data: { nome: `[ANON-${sufixo}]`, cpf: "00000000000", email: null, telefone: null },
      });
      // Desativa acessos do portal
      await tx.clienteAcesso.updateMany({
        where: { clienteId: sol.clienteId },
        data: { ativo: false, password: null },
      });
    });

    updated = await prisma.solicitacaoExclusaoLgpd.update({
      where: { id: params.id },
      data: { status: "EXECUTADA", executadoEm: new Date() },
    });
  }

  await audit({
    session,
    action: `lgpd.exclusao.${parsed.data.acao}`,
    resource: "cliente",
    resourceId: sol.clienteId,
    before: sol,
    after: updated,
    request: req,
  });

  return NextResponse.json(updated);
}
