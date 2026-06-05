import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";

/**
 * Lista todos os acessos do portal de cliente — pra tela /configuracoes/portal-cliente.
 * Filtra por status (ativos/inativos), busca por nome/email/razão social.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try { assertEquipe(session); }
  catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const status = url.searchParams.get("status") ?? "TODOS"; // TODOS | COM_ACESSO | SEM_ACESSO

  // Lista todos clientes (não soft-deleted) + acessos
  const clientes = await prisma.cliente.findMany({
    where: {
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { razaoSocial: { contains: q, mode: "insensitive" } },
              { nomeFantasia: { contains: q, mode: "insensitive" } },
              { cpfCnpj: { contains: q } },
              { acessos: { some: { email: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      codigo: true,
      razaoSocial: true,
      nomeFantasia: true,
      status: true,
      acessos: {
        select: {
          id: true, email: true, nome: true, ativo: true,
          ultimoAcesso: true, tokenConvite: true, tokenConviteExpira: true,
          password: true, createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { codigo: "asc" },
    take: 200,
  });

  const mapped = clientes.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    razaoSocial: c.razaoSocial,
    nomeFantasia: c.nomeFantasia,
    status: c.status,
    acessos: c.acessos.map((a) => ({
      id: a.id,
      email: a.email,
      nome: a.nome,
      ativo: a.ativo,
      ultimoAcesso: a.ultimoAcesso,
      temSenha: Boolean(a.password),
      conviteAtivo: Boolean(a.tokenConvite && a.tokenConviteExpira && a.tokenConviteExpira > new Date()),
      conviteExpiraEm: a.tokenConviteExpira,
      createdAt: a.createdAt,
    })),
  }));

  // Filtro de status
  const filtered = mapped.filter((c) => {
    if (status === "COM_ACESSO") return c.acessos.some((a) => a.temSenha);
    if (status === "SEM_ACESSO") return c.acessos.length === 0;
    return true;
  });

  return NextResponse.json({
    clientes: filtered,
    totais: {
      totalClientes: filtered.length,
      comAcessoAtivo: filtered.filter((c) => c.acessos.some((a) => a.temSenha && a.ativo)).length,
      comConvitePendente: filtered.filter((c) => c.acessos.some((a) => a.conviteAtivo && !a.temSenha)).length,
      semAcesso: filtered.filter((c) => c.acessos.length === 0).length,
    },
  });
}
