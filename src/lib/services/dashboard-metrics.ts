/**
 * Agregações para o Dashboard.
 *
 * Todas as funções retornam dados já prontos para os gráficos (Recharts)
 * e usam Postgres (Prisma) + MongoDB quando necessário.
 */

import { prisma } from "@/lib/db/prisma";
import { connectMongo } from "@/lib/db/mongo";
import { FormResponseModel } from "@/models/FormResponse";
import { addMonths, startOfMonth, endOfMonth, format, subDays, eachMonthOfInterval } from "date-fns";

const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// ================================================
// KPIs principais
// ================================================
export async function getKpis() {
  const hoje = new Date();
  const inicioMes = startOfMonth(hoje);

  const [
    clientesAtivos,
    clientesTotal,
    cobrancasAbertas,
    valorEmAberto,
    valorAtrasado,
    execHoje,
    pagoNoMes,
    respostasMes,
  ] = await Promise.all([
    prisma.cliente.count({ where: { status: "ATIVO" } }),
    prisma.cliente.count(),
    prisma.cobranca.count({ where: { status: { in: ["ABERTO", "ATRASADO"] } } }),
    prisma.cobranca.aggregate({
      _sum: { valor: true },
      where: { status: { in: ["ABERTO", "ATRASADO"] } },
    }),
    prisma.cobranca.aggregate({
      _sum: { valor: true },
      where: { status: "ATRASADO" },
    }),
    prisma.execucaoRegua.count({
      where: { status: "ENVIADO", enviadoEm: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
    prisma.cobranca.aggregate({
      _sum: { valor: true },
      where: { status: "PAGO", dataPagamento: { gte: inicioMes } },
    }),
    connectMongo().then(() =>
      FormResponseModel.countDocuments({ createdAt: { $gte: inicioMes } })
    ),
  ]);

  return {
    clientesAtivos,
    clientesTotal,
    cobrancasAbertas,
    valorEmAberto: Number(valorEmAberto._sum.valor ?? 0),
    valorAtrasado: Number(valorAtrasado._sum.valor ?? 0),
    pagoNoMes: Number(pagoNoMes._sum.valor ?? 0),
    execucoesHoje: execHoje,
    respostasMes,
  };
}

// ================================================
// Cobranças emitidas x pagas por mês (últimos 6 meses)
// ================================================
export async function getCobrancasTimeline(meses = 6) {
  const hoje = new Date();
  const inicio = startOfMonth(addMonths(hoje, -meses + 1));

  const cobrancas = await prisma.cobranca.findMany({
    where: { vencimento: { gte: inicio } },
    select: { valor: true, vencimento: true, dataPagamento: true, status: true },
  });

  const buckets = eachMonthOfInterval({ start: inicio, end: hoje }).map((d) => ({
    mes: `${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
    emitido: 0,
    pago: 0,
    atrasado: 0,
    _ref: d,
  }));

  for (const c of cobrancas) {
    const b = buckets.find((x) =>
      c.vencimento >= startOfMonth(x._ref) && c.vencimento <= endOfMonth(x._ref)
    );
    if (!b) continue;
    b.emitido += Number(c.valor);
    if (c.status === "PAGO") b.pago += Number(c.valor);
    if (c.status === "ATRASADO") b.atrasado += Number(c.valor);
  }

  return buckets.map(({ _ref, ...rest }) => rest);
}

// ================================================
// Funil de formulários por status
// ================================================
export async function getFormsFunil() {
  await connectMongo();
  const agg = await FormResponseModel.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(agg.map((a) => [a._id, a.count]));
  return [
    { etapa: "Recebido", total: map["RECEBIDO"] ?? 0, fill: "#3B82F6" },
    { etapa: "Em análise", total: map["EM_ANALISE"] ?? 0, fill: "#F59E0B" },
    { etapa: "Aplicado", total: map["APLICADO"] ?? 0, fill: "#84CC16" },
    { etapa: "Rejeitado", total: map["REJEITADO"] ?? 0, fill: "#EF4444" },
  ];
}

// ================================================
// Top 10 clientes em atraso (com valor ATUALIZADO — Patrick 28/04)
// ================================================
export async function getTopAtrasos(limit = 10) {
  const { calcularValorAtualizadoSync, getConfigCobranca, parseSnapshot } = await import("./valor-atualizado");

  // Pega TODAS as cobranças atrasadas (até 500 — limit por garantia) pra calcular atualização real
  const atrasadas = await prisma.cobranca.findMany({
    where: { status: "ATRASADO" },
    select: { clienteId: true, valor: true, vencimento: true, regraJurosSnapshot: true },
    take: 500,
  });

  const configGlobal = await getConfigCobranca();
  const hoje = new Date();

  // Agrupa por cliente, somando valor BRUTO + valor ATUALIZADO.
  // Cada cobrança usa seu snapshot (regra do dia que nasceu) ou a config global se for legado.
  const grupo = new Map<string, { bruto: number; atualizado: number; qtd: number }>();
  for (const c of atrasadas) {
    const cfgItem = parseSnapshot(c.regraJurosSnapshot) ?? configGlobal;
    const r = calcularValorAtualizadoSync(Number(c.valor), c.vencimento, hoje, cfgItem);
    const cur = grupo.get(c.clienteId) ?? { bruto: 0, atualizado: 0, qtd: 0 };
    cur.bruto += r.bruto;
    cur.atualizado += r.total;
    cur.qtd += 1;
    grupo.set(c.clienteId, cur);
  }

  // Ordena por valor atualizado desc
  const ordenado = Array.from(grupo.entries())
    .map(([clienteId, v]) => ({ clienteId, ...v }))
    .sort((a, b) => b.atualizado - a.atualizado)
    .slice(0, limit);

  const clientes = await prisma.cliente.findMany({
    where: { id: { in: ordenado.map((a) => a.clienteId) } },
    select: { id: true, razaoSocial: true, nomeFantasia: true },
  });
  const nomeMap = Object.fromEntries(
    clientes.map((c) => {
      const escolhido = c.nomeFantasia ?? c.razaoSocial;
      const curto = escolhido.length > 20 ? escolhido.slice(0, 19).trim() + "…" : escolhido;
      return [c.id, curto];
    })
  );

  return ordenado.map((a) => ({
    cliente: nomeMap[a.clienteId] ?? a.clienteId.slice(0, 8),
    clienteId: a.clienteId,
    valor: a.atualizado,        // pra compatibilidade — o gráfico já usa "valor"
    valorBruto: a.bruto,
    valorAtualizado: a.atualizado,
    acrescimo: a.atualizado - a.bruto,
    qtd: a.qtd,
  }));
}

// ================================================
// Distribuição por classificação
// ================================================
export async function getClassificacaoBreakdown() {
  const agg = await prisma.cliente.groupBy({
    by: ["classificacao"],
    _count: true,
    where: { status: "ATIVO" },
  });

  const CORES: Record<string, string> = {
    TOP: "#1E3A8A",
    OURO: "#F59E0B",
    PRATA: "#94A3B8",
    BRONZE: "#A16207",
    NULL: "#CBD5E1",
  };

  return agg.map((a) => ({
    classificacao: a.classificacao ?? "Sem classificação",
    total: a._count,
    fill: CORES[a.classificacao ?? "NULL"] ?? "#CBD5E1",
  }));
}

// ================================================
// Execuções da régua nos últimos 30 dias por status
// ================================================
export async function getReguaStatus(dias = 30) {
  const desde = subDays(new Date(), dias);
  const execucoes = await prisma.execucaoRegua.findMany({
    where: { createdAt: { gte: desde } },
    select: { status: true, enviadoEm: true, agendadoPara: true, createdAt: true },
  });

  const porDia = new Map<string, Record<string, number>>();
  for (let i = 0; i < dias; i++) {
    const d = subDays(new Date(), dias - 1 - i);
    porDia.set(format(d, "yyyy-MM-dd"), { ENVIADO: 0, ERRO: 0, PENDENTE: 0, PULADO: 0 });
  }

  for (const e of execucoes) {
    const ref = e.enviadoEm ?? e.agendadoPara ?? e.createdAt;
    const key = format(ref, "yyyy-MM-dd");
    const bucket = porDia.get(key);
    if (bucket) bucket[e.status] = (bucket[e.status] ?? 0) + 1;
  }

  return Array.from(porDia.entries()).map(([dia, v]) => ({
    dia: format(new Date(dia), "dd/MM"),
    ENVIADO: v.ENVIADO ?? 0,
    ERRO: v.ERRO ?? 0,
    PENDENTE: v.PENDENTE ?? 0,
    PULADO: v.PULADO ?? 0,
  }));
}

// ================================================
// Próximas cobranças a vencer (7 dias)
// ================================================
export async function getProximasCobrancas(dias = 7, limit = 10) {
  const hoje = new Date();
  const limite = new Date();
  limite.setDate(limite.getDate() + dias);
  return prisma.cobranca.findMany({
    where: { status: "ABERTO", vencimento: { gte: hoje, lte: limite } },
    orderBy: { vencimento: "asc" },
    take: limit,
    include: { cliente: { select: { razaoSocial: true, id: true } } },
  });
}
