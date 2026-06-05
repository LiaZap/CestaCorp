/**
 * Serviço de inadimplência — agrega cobranças em atraso por cliente.
 *
 * Patrick (call 18/05): "regra três cobranças em abertos ou contrato suspenso
 * (...) coloca nesses clientes em atraso uma marcaçãozinha vermelha (...) ele
 * tem que primeiro passar no financeiro pra ser cobrado, porque se tá com a
 * bolinha vermelha significa que tá mais de três mensalidades".
 *
 * Threshold default = 3 (configurável via INADIMPLENCIA_BOLINHA_VERMELHA).
 */

import { prisma } from "@/lib/db/prisma";

export const NIVEL_BOLINHA_VERMELHA = Number(
  process.env.INADIMPLENCIA_BOLINHA_VERMELHA ?? "3"
);

export type NivelInadimplencia = "EM_DIA" | "UMA" | "DUAS" | "TRES_OU_MAIS";

/** Categoriza um cliente pelo número de cobranças em atraso. */
export function nivelPara(qtd: number): NivelInadimplencia {
  if (qtd <= 0) return "EM_DIA";
  if (qtd === 1) return "UMA";
  if (qtd === 2) return "DUAS";
  return "TRES_OU_MAIS";
}

/** Conta cobranças atrasadas por cliente. Filtra status ATRASADO + status ABERTO com vencimento passado. */
export async function contarAtrasadasPorCliente(
  clienteIds?: string[]
): Promise<Map<string, number>> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const grupos = await prisma.cobranca.groupBy({
    by: ["clienteId"],
    where: {
      ...(clienteIds && clienteIds.length > 0 ? { clienteId: { in: clienteIds } } : {}),
      OR: [
        { status: "ATRASADO" },
        { status: "ABERTO", vencimento: { lt: hoje } },
      ],
    },
    _count: { _all: true },
  });

  const map = new Map<string, number>();
  for (const g of grupos) map.set(g.clienteId, g._count._all);
  return map;
}

/** Agrega: quantos clientes têm 0/1/2/3+ cobranças em atraso. */
export async function distribuicaoInadimplencia(): Promise<{
  total: number;
  porNivel: Record<NivelInadimplencia, number>;
  totalInadimplentes: number;
  totalBolinhaVermelha: number;
}> {
  const totalAtivos = await prisma.cliente.count({ where: { status: "ATIVO" } });
  const mapa = await contarAtrasadasPorCliente();

  const contagem: Record<NivelInadimplencia, number> = {
    EM_DIA: 0,
    UMA: 0,
    DUAS: 0,
    TRES_OU_MAIS: 0,
  };

  // Clientes com cobranças em atraso (mapa)
  let totalComAtraso = 0;
  for (const qtd of mapa.values()) {
    totalComAtraso++;
    contagem[nivelPara(qtd)]++;
  }
  // O resto está em dia (ativos sem cobrança atrasada)
  contagem.EM_DIA = Math.max(0, totalAtivos - totalComAtraso);

  return {
    total: totalAtivos,
    porNivel: contagem,
    totalInadimplentes: totalComAtraso,
    totalBolinhaVermelha: contagem.TRES_OU_MAIS,
  };
}

/**
 * Lista os top clientes com mais cobranças em atraso (pra dashboard / régua).
 * Inclui dados do cliente pra exibição direta + valor consolidado em aberto.
 */
export async function topInadimplentes(limite = 20): Promise<Array<{
  clienteId: string;
  codigo: number | null;
  razaoSocial: string;
  nomeFantasia: string | null;
  qtdAtrasadas: number;
  valorAtrasado: number;
}>> {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const grupos = await prisma.cobranca.groupBy({
    by: ["clienteId"],
    where: {
      OR: [
        { status: "ATRASADO" },
        { status: "ABERTO", vencimento: { lt: hoje } },
      ],
    },
    _count: { _all: true },
    _sum: { valor: true },
    orderBy: { _count: { id: "desc" } },
    take: limite,
  });

  if (grupos.length === 0) return [];

  const clientes = await prisma.cliente.findMany({
    where: { id: { in: grupos.map((g) => g.clienteId) } },
    select: { id: true, codigo: true, razaoSocial: true, nomeFantasia: true },
  });
  const porId = new Map(clientes.map((c) => [c.id, c]));

  return grupos
    .map((g) => {
      const c = porId.get(g.clienteId);
      if (!c) return null;
      return {
        clienteId: g.clienteId,
        codigo: c.codigo,
        razaoSocial: c.razaoSocial,
        nomeFantasia: c.nomeFantasia,
        qtdAtrasadas: g._count._all,
        valorAtrasado: Number(g._sum.valor ?? 0),
      };
    })
    .filter(Boolean) as any;
}
