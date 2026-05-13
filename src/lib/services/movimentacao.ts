/**
 * Relatório de movimentação de carteira.
 *
 * Patrick (24/04/2026): "todo dia 4 a gente faz reunião e mostra:
 *   - quantos clientes entraram no mês, por regime
 *   - quantos saíram, com motivo
 *   - lista nominal"
 *
 * Fonte de dados:
 *   - Cliente.inicio (entrada) e Cliente.status === ENCERRADO + updatedAt (saída).
 *   - Categoria/regime via Cliente.tributacao ou Tag(categoria=REGIME).
 */

import { prisma } from "@/lib/db/prisma";

export interface MovimentacaoMes {
  ano: number;
  mes: number;          // 1..12
  entradas: ClienteMovimentado[];
  saidas: ClienteMovimentado[];
  totalAtivo: number;
  resumoPorRegime: { regime: string; entradas: number; saidas: number }[];
}

export interface ClienteMovimentado {
  id: string;
  codigo: number | null;
  razaoSocial: string;
  nomeFantasia: string | null;
  cpfCnpj: string;
  classificacao: string | null;
  tributacao: string | null;
  categoria: string | null;
  status: string;
  inicio: string | null;       // ISO
  fim: string | null;          // ISO (quando saiu)
  motivoSaida: string | null;
  honorario: number | null;
}

function inicioDoMes(ano: number, mes: number): Date {
  return new Date(ano, mes - 1, 1, 0, 0, 0, 0);
}
function fimDoMes(ano: number, mes: number): Date {
  return new Date(ano, mes, 0, 23, 59, 59, 999);
}

/**
 * Movimentação de um mês específico.
 */
export async function getMovimentacaoMes(ano: number, mes: number): Promise<MovimentacaoMes> {
  const ini = inicioDoMes(ano, mes);
  const fim = fimDoMes(ano, mes);

  // Entradas: clientes que tiveram inicio no mês alvo
  const entradas = await prisma.cliente.findMany({
    where: { inicio: { gte: ini, lte: fim } },
    orderBy: { inicio: "asc" },
    include: {
      honorarios: { orderBy: { vencimento: "desc" }, take: 1 },
    },
  });

  // Saídas: clientes ENCERRADOS cujo updatedAt cai no mês (proxy melhor seria fim explícito)
  const saidas = await prisma.cliente.findMany({
    where: {
      status: "ENCERRADO",
      updatedAt: { gte: ini, lte: fim },
    },
    orderBy: { updatedAt: "asc" },
    include: {
      honorarios: { orderBy: { vencimento: "desc" }, take: 1 },
    },
  });

  // Total ativo no fim do mês
  const totalAtivo = await prisma.cliente.count({
    where: {
      status: "ATIVO",
      OR: [
        { inicio: { lte: fim } },
        { inicio: null },
      ],
    },
  });

  // Resumo por regime
  const regimes = new Map<string, { entradas: number; saidas: number }>();
  function bump(r: string | null, dir: "entradas" | "saidas") {
    const k = r ?? "Não informado";
    const cur = regimes.get(k) ?? { entradas: 0, saidas: 0 };
    cur[dir]++;
    regimes.set(k, cur);
  }
  entradas.forEach((c) => bump(c.tributacao, "entradas"));
  saidas.forEach((c) => bump(c.tributacao, "saidas"));

  function map(c: any): ClienteMovimentado {
    return {
      id: c.id,
      codigo: c.codigo,
      razaoSocial: c.razaoSocial,
      nomeFantasia: c.nomeFantasia,
      cpfCnpj: c.cpfCnpj,
      classificacao: c.classificacao,
      tributacao: c.tributacao,
      categoria: null,
      status: c.status,
      inicio: c.inicio?.toISOString() ?? null,
      fim: c.status === "ENCERRADO" ? c.updatedAt?.toISOString() ?? null : null,
      motivoSaida: null,
      honorario: c.honorarios?.[0]?.valor ? Number(c.honorarios[0].valor) : null,
    };
  }

  return {
    ano,
    mes,
    entradas: entradas.map(map),
    saidas: saidas.map(map),
    totalAtivo,
    resumoPorRegime: Array.from(regimes.entries())
      .map(([regime, r]) => ({ regime, ...r }))
      .sort((a, b) => (b.entradas + b.saidas) - (a.entradas + a.saidas)),
  };
}

/**
 * Histórico anual: por mês do ano corrente, retorna { entradas, saidas, ativos } pra montar gráficos.
 */
export async function getHistoricoAnual(ano: number) {
  const meses = [];
  for (let mes = 1; mes <= 12; mes++) {
    const ini = inicioDoMes(ano, mes);
    const fim = fimDoMes(ano, mes);

    const [entradas, saidas, ativos] = await Promise.all([
      prisma.cliente.count({ where: { inicio: { gte: ini, lte: fim } } }),
      prisma.cliente.count({
        where: { status: "ENCERRADO", updatedAt: { gte: ini, lte: fim } },
      }),
      prisma.cliente.count({
        where: {
          status: "ATIVO",
          OR: [{ inicio: { lte: fim } }, { inicio: null }],
        },
      }),
    ]);

    meses.push({
      mes,
      label: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][mes - 1],
      entradas,
      saidas,
      ativos,
      saldo: entradas - saidas,
    });
  }
  return { ano, meses };
}

/**
 * Distribuição atual (snapshot) por regime + categoria.
 */
export async function getDistribuicaoAtual() {
  const porRegime = await prisma.cliente.groupBy({
    by: ["tributacao"],
    where: { status: "ATIVO" },
    _count: true,
  });

  const porClassificacao = await prisma.cliente.groupBy({
    by: ["classificacao"],
    where: { status: "ATIVO" },
    _count: true,
  });

  const porPrefeitura = await prisma.cliente.groupBy({
    by: ["prefeitura"],
    where: { status: "ATIVO" },
    _count: true,
    orderBy: { _count: { prefeitura: "desc" } },
    take: 10,
  });

  return {
    porRegime: porRegime
      .map((r) => ({ regime: r.tributacao ?? "Não informado", total: r._count }))
      .sort((a, b) => b.total - a.total),
    porClassificacao: porClassificacao
      .map((c) => ({ classificacao: c.classificacao ?? "Sem classificação", total: c._count }))
      .sort((a, b) => b.total - a.total),
    porPrefeitura: porPrefeitura
      .map((p) => ({ prefeitura: p.prefeitura ?? "Não informado", total: p._count })),
  };
}
