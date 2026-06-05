/**
 * Projeção de reajustes — Patrick (call 18/05): "saber como tá a projeção, já
 * sabe quanto é que fica, né, totalizador. Quanto que a gente tá tendo de
 * reajuste, como ficariam os valores".
 *
 * Diferente do reajuste.ts (que aplica HOJE no mês corrente), aqui projetamos
 * cliente×mês pra todos os meses do range escolhido (3 / 6 / 12 meses à frente).
 *
 * NÃO faz chamada externa BCB por mês — usa o índice acumulado 12m atual
 * como aproximação (suficiente pra "ordem de grandeza"). Patrick decide
 * quando aplica reajuste com o número real do mês.
 */

import { prisma } from "@/lib/db/prisma";
import { obterIndiceAcumulado12m, type Indice } from "./reajuste";

export interface ProjecaoItem {
  clienteId: string;
  codigo: number | null;
  razaoSocial: string;
  contratoId: string | null;
  indice: Indice | "FIXO";
  percentual: number;       // % acumulado 12m do índice (ou 0 se FIXO sem regra)
  valorAtual: number;
  valorProposto: number;
  diferencaMensal: number;
  diferencaAnualizada: number;
  mesAniversario: number;
  mesAniversarioNome: string;
  ano: number;
  dataReajuste: Date;       // primeiro dia do mês aniversário no ano correspondente
  classificacao: string | null;
  segmento: string | null;
}

export interface ProjecaoTotais {
  qtdClientes: number;
  qtdContratos: number;
  receitaAtualMensal: number;
  receitaProjetadaMensal: number;
  incrementoMensal: number;
  incrementoAnualizado: number;
  percentualMedio: number;
}

const MESES_NOMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/**
 * Calcula projeção pro range a partir de hoje.
 * @param mesesAFrente quantos meses cobrir (3, 6 ou 12 é o típico)
 */
export async function projetarReajustes(
  mesesAFrente: number = 3
): Promise<{ itens: ProjecaoItem[]; totais: ProjecaoTotais; porMes: Record<string, ProjecaoTotais & { mes: number; ano: number; rotulo: string }> }> {
  const hoje = new Date();
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  // Lista de (mes, ano) cobertos
  const intervalos: Array<{ mes: number; ano: number }> = [];
  for (let i = 0; i < mesesAFrente; i++) {
    const m = (mesAtual + i - 1) % 12 + 1;
    const a = anoAtual + Math.floor((mesAtual + i - 1) / 12);
    intervalos.push({ mes: m, ano: a });
  }
  const mesesAlvo = [...new Set(intervalos.map((x) => x.mes))];

  // Pré-carrega índices uma vez (cache 6h)
  const [ipca, igpm, inpc] = await Promise.all([
    obterIndiceAcumulado12m("IPCA").catch(() => 0),
    obterIndiceAcumulado12m("IGPM").catch(() => 0),
    obterIndiceAcumulado12m("INPC").catch(() => 0),
  ]);
  const indices: Record<string, number> = { IPCA: ipca, IGPM: igpm, INPC: inpc, FIXO: 0 };

  // Busca clientes ativos com aniversário em algum dos meses-alvo + contrato ativo
  const clientes = await prisma.cliente.findMany({
    where: {
      deletedAt: null,
      status: "ATIVO",
      mesAniversarioReajuste: { in: mesesAlvo },
      contratos: { some: { valorHonorarios: { gt: 0 } } },
    },
    select: {
      id: true,
      codigo: true,
      razaoSocial: true,
      classificacao: true,
      seguimento: true,
      categoria: true,
      indiceReajuste: true,
      mesAniversarioReajuste: true,
      contratos: {
        where: { valorHonorarios: { gt: 0 } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, valorHonorarios: true },
      },
    },
  });

  const itens: ProjecaoItem[] = [];
  for (const c of clientes) {
    const contrato = c.contratos[0];
    if (!contrato) continue;
    const valorAtual = Number(contrato.valorHonorarios);
    if (!valorAtual) continue;
    const indice = (c.indiceReajuste ?? "IPCA") as Indice | "FIXO";
    const percentual = indices[indice] ?? 0;
    const valorProposto = Number((valorAtual * (1 + percentual / 100)).toFixed(2));
    const mesAniv = c.mesAniversarioReajuste!;
    // Acha o ano em que esse cliente cai no nosso range
    const cobertura = intervalos.find((x) => x.mes === mesAniv);
    if (!cobertura) continue;
    const dataReajuste = new Date(cobertura.ano, mesAniv - 1, 1);

    itens.push({
      clienteId: c.id,
      codigo: c.codigo,
      razaoSocial: c.razaoSocial,
      contratoId: contrato.id,
      indice,
      percentual,
      valorAtual,
      valorProposto,
      diferencaMensal: Number((valorProposto - valorAtual).toFixed(2)),
      diferencaAnualizada: Number(((valorProposto - valorAtual) * 12).toFixed(2)),
      mesAniversario: mesAniv,
      mesAniversarioNome: MESES_NOMES[mesAniv - 1],
      ano: cobertura.ano,
      dataReajuste,
      classificacao: c.classificacao,
      segmento: c.seguimento ?? c.categoria,
    });
  }

  // Ordena por data de reajuste
  itens.sort((a, b) => a.dataReajuste.getTime() - b.dataReajuste.getTime());

  const totais = somar(itens);

  // Agrupa por mês/ano
  const porMes: Record<string, ProjecaoTotais & { mes: number; ano: number; rotulo: string }> = {};
  for (const it of itens) {
    const key = `${it.ano}-${String(it.mesAniversario).padStart(2, "0")}`;
    if (!porMes[key]) {
      porMes[key] = {
        ...somar([]),
        mes: it.mesAniversario,
        ano: it.ano,
        rotulo: `${it.mesAniversarioNome}/${it.ano}`,
      };
    }
    const acc = porMes[key];
    porMes[key] = {
      ...acumular(acc, it),
      mes: acc.mes,
      ano: acc.ano,
      rotulo: acc.rotulo,
    };
  }

  return { itens, totais, porMes };
}

function somar(itens: ProjecaoItem[]): ProjecaoTotais {
  let acc: ProjecaoTotais = {
    qtdClientes: 0,
    qtdContratos: 0,
    receitaAtualMensal: 0,
    receitaProjetadaMensal: 0,
    incrementoMensal: 0,
    incrementoAnualizado: 0,
    percentualMedio: 0,
  };
  for (const it of itens) acc = acumular(acc, it);
  return acc;
}

function acumular(acc: ProjecaoTotais, it: ProjecaoItem): ProjecaoTotais {
  const novoCount = acc.qtdContratos + 1;
  return {
    qtdClientes: acc.qtdClientes + 1, // 1 cliente, 1 contrato vigente — pegamos só o mais recente
    qtdContratos: novoCount,
    receitaAtualMensal: round2(acc.receitaAtualMensal + it.valorAtual),
    receitaProjetadaMensal: round2(acc.receitaProjetadaMensal + it.valorProposto),
    incrementoMensal: round2(acc.incrementoMensal + it.diferencaMensal),
    incrementoAnualizado: round2(acc.incrementoAnualizado + it.diferencaAnualizada),
    percentualMedio: round2(((acc.percentualMedio * acc.qtdContratos) + it.percentual) / novoCount),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
