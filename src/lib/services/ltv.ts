/**
 * LTV (Lifetime Value) de clientes.
 *
 * Patrick (13/06 WhatsApp): "seria conseguirmos entender o LTV dos clientes,
 * ou seja, qual a média que os clientes ficam na nossa base. Como temos na
 * V106 tanto a data de inicio (coluna T), quanto fim do contrato (coluna AD)".
 *
 * Cálculo:
 *   - Cada cliente com `inicio` (e opcionalmente `dataEncerramento`) gera
 *     uma duração em meses
 *   - Clientes ativos: duração = hoje - inicio
 *   - Clientes encerrados: duração = dataEncerramento - inicio
 *   - LTV monetário = duração_meses × honorarioMedioMensal
 *     (média dos honorários PAGO do cliente; se nenhum pago, usa
 *     Contrato.valorHonorarios atual)
 *
 * Segmenta por:
 *   - status (ATIVO vs ENCERRADO)
 *   - classificação (BRONZE/PRATA/OURO/DIAMANTE)
 *   - segmento (categoria livre)
 *   - regime (tributacao)
 *
 * Retorna agregado pro relatório.
 */

import { prisma } from "@/lib/db/prisma";

export interface LtvAgregado {
  segmento: string;
  qtdClientes: number;
  duracaoMediaMeses: number;
  duracaoMaximaMeses: number;
  duracaoMinimaMeses: number;
  honorarioMedioMensal: number;
  ltvMedio: number; // em R$
  receitaTotalAcumulada: number;
}

interface ClienteLtv {
  id: string;
  status: string;
  classificacao: string | null;
  categoria: string | null;
  tributacao: string | null;
  inicio: Date | null;
  dataEncerramento: Date | null;
  honorarios: { valor: any; status: string }[];
  contratos: { valorHonorarios: any }[];
}

/** Calcula duração em meses entre duas datas (mesma utilidade do diff date-fns). */
export function duracaoMeses(de: Date, ate: Date): number {
  const dias = Math.max(0, (ate.getTime() - de.getTime()) / (1000 * 60 * 60 * 24));
  return Math.round((dias / 30.4375) * 10) / 10; // 1 casa decimal
}

function honorarioMedioMensal(c: ClienteLtv): number {
  // Preferência: média dos pagos
  const pagos = c.honorarios.filter((h) => h.status === "PAGO").map((h) => Number(h.valor));
  if (pagos.length > 0) {
    return pagos.reduce((s, v) => s + v, 0) / pagos.length;
  }
  // Fallback: maior valorHonorarios dos contratos atuais
  const contratos = c.contratos.map((x) => Number(x.valorHonorarios));
  if (contratos.length > 0) return Math.max(...contratos);
  return 0;
}

function calcularLtvCliente(c: ClienteLtv): { dur: number; hon: number; ltv: number } | null {
  if (!c.inicio) return null;
  const fim = c.dataEncerramento ?? new Date();
  const dur = duracaoMeses(c.inicio, fim);
  if (dur <= 0) return null;
  const hon = honorarioMedioMensal(c);
  return { dur, hon, ltv: dur * hon };
}

async function buscarTodos(): Promise<ClienteLtv[]> {
  const cs = await prisma.cliente.findMany({
    where: { deletedAt: null, inicio: { not: null } },
    select: {
      id: true,
      status: true,
      classificacao: true,
      categoria: true,
      tributacao: true,
      inicio: true,
      dataEncerramento: true,
      honorarios: { select: { valor: true, status: true } },
      contratos: { select: { valorHonorarios: true } },
    },
  });
  return cs as any;
}

function agregar(grupo: string, clientes: Array<{ dur: number; hon: number; ltv: number }>): LtvAgregado {
  const n = clientes.length;
  if (n === 0) {
    return {
      segmento: grupo,
      qtdClientes: 0,
      duracaoMediaMeses: 0,
      duracaoMaximaMeses: 0,
      duracaoMinimaMeses: 0,
      honorarioMedioMensal: 0,
      ltvMedio: 0,
      receitaTotalAcumulada: 0,
    };
  }
  const duracoes = clientes.map((c) => c.dur);
  const ltv = clientes.map((c) => c.ltv);
  const honor = clientes.map((c) => c.hon);
  return {
    segmento: grupo,
    qtdClientes: n,
    duracaoMediaMeses: Math.round((duracoes.reduce((s, v) => s + v, 0) / n) * 10) / 10,
    duracaoMaximaMeses: Math.round(Math.max(...duracoes) * 10) / 10,
    duracaoMinimaMeses: Math.round(Math.min(...duracoes) * 10) / 10,
    honorarioMedioMensal: Math.round((honor.reduce((s, v) => s + v, 0) / n) * 100) / 100,
    ltvMedio: Math.round((ltv.reduce((s, v) => s + v, 0) / n) * 100) / 100,
    receitaTotalAcumulada: Math.round(ltv.reduce((s, v) => s + v, 0) * 100) / 100,
  };
}

/** Quebra os clientes em grupos por uma chave e calcula agregados de cada um. */
function agruparPor(
  clientes: Array<ClienteLtv & { _calc: { dur: number; hon: number; ltv: number } }>,
  chave: (c: ClienteLtv) => string
): LtvAgregado[] {
  const grupos = new Map<string, Array<{ dur: number; hon: number; ltv: number }>>();
  for (const c of clientes) {
    const k = chave(c) || "(sem)";
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k)!.push(c._calc);
  }
  return [...grupos.entries()]
    .map(([g, lista]) => agregar(g, lista))
    .sort((a, b) => b.qtdClientes - a.qtdClientes);
}

export async function relatorioLtv(): Promise<{
  total: LtvAgregado;
  porStatus: LtvAgregado[];
  porClassificacao: LtvAgregado[];
  porCategoria: LtvAgregado[];
  porTributacao: LtvAgregado[];
  topMaisAntigos: Array<{
    id: string;
    razaoSocial: string;
    codigo: number | null;
    duracaoMeses: number;
    ltv: number;
    ativo: boolean;
  }>;
  topMaiorLtv: Array<{
    id: string;
    razaoSocial: string;
    codigo: number | null;
    duracaoMeses: number;
    ltv: number;
    ativo: boolean;
  }>;
}> {
  const todos = await buscarTodos();
  type ComCalc = ClienteLtv & { _calc: { dur: number; hon: number; ltv: number } };
  const comCalc: ComCalc[] = [];
  for (const c of todos) {
    const calc = calcularLtvCliente(c);
    if (calc) comCalc.push({ ...c, _calc: calc });
  }

  // Total geral
  const total = agregar(
    "Todos",
    comCalc.map((c) => c._calc)
  );

  // Por dimensão
  const porStatus = agruparPor(comCalc, (c) => c.status);
  const porClassificacao = agruparPor(comCalc, (c) => c.classificacao ?? "(sem classificação)");
  const porCategoria = agruparPor(comCalc, (c) => c.categoria ?? "(sem categoria)");
  const porTributacao = agruparPor(comCalc, (c) => c.tributacao ?? "(sem tributação)");

  // Pra esses 2 rankings precisamos dos nomes — busca em separado
  const ids = comCalc.map((c) => c.id);
  const meta = await prisma.cliente.findMany({
    where: { id: { in: ids } },
    select: { id: true, codigo: true, razaoSocial: true, status: true },
  });
  const porId = new Map(meta.map((m) => [m.id, m]));

  function ranking(
    ordenadores: (a: any, b: any) => number,
    limite = 15
  ) {
    return comCalc
      .map((c) => {
        const m = porId.get(c.id);
        return m ? { ...c, _meta: m } : null;
      })
      .filter(Boolean)
      .sort(ordenadores as any)
      .slice(0, limite)
      .map((c: any) => ({
        id: c._meta.id,
        razaoSocial: c._meta.razaoSocial,
        codigo: c._meta.codigo,
        duracaoMeses: c._calc.dur,
        ltv: c._calc.ltv,
        ativo: c._meta.status === "ATIVO",
      }));
  }

  const topMaisAntigos = ranking((a: any, b: any) => b._calc.dur - a._calc.dur, 15);
  const topMaiorLtv = ranking((a: any, b: any) => b._calc.ltv - a._calc.ltv, 15);

  return { total, porStatus, porClassificacao, porCategoria, porTributacao, topMaisAntigos, topMaiorLtv };
}
