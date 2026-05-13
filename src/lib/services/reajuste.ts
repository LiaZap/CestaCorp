/**
 * Cálculo automático de reajuste contratual.
 *
 * Funcionamento:
 *  1. Busca IPCA/IGPM/INPC acumulado nos últimos 12 meses (fonte configurável).
 *  2. Para cada cliente cujo mês-aniversário é o mês corrente, aplica o índice
 *     sobre o valor de honorários vigente.
 *  3. Cria uma "proposta de reajuste" (apenas flag/campo; a operação confirma
 *     manualmente antes de refletir em novos contratos/boletos).
 */

import { prisma } from "@/lib/db/prisma";
import axios from "axios";

const URL_SGS = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";
const SERIES = {
  IPCA: 433,   // IPCA — BCB
  IGPM: 189,   // IGP-M — BCB
  INPC: 188,   // INPC — BCB
} as const;

export type Indice = keyof typeof SERIES;

// cache simples em memória
const cache = new Map<string, { valor: number; ts: number }>();

/**
 * Acumulado dos últimos 12 meses (percentual ex.: 4.72 = 4,72%).
 */
export async function obterIndiceAcumulado12m(indice: Indice): Promise<number> {
  const key = `${indice}:12m`;
  const agora = Date.now();
  const cached = cache.get(key);
  if (cached && agora - cached.ts < 6 * 60 * 60 * 1000) return cached.valor;

  const serie = SERIES[indice];
  const { data } = await axios.get(
    `${URL_SGS}.${serie}/dados/ultimos/12?formato=json`,
    { timeout: 15_000 }
  );

  // Cada ponto traz a variação mensal em %. Acumulado = produto de (1 + r/100) - 1
  const acumulado = data.reduce((acc: number, d: any) => acc * (1 + Number(d.valor) / 100), 1) - 1;
  const pct = acumulado * 100;
  cache.set(key, { valor: pct, ts: agora });
  return pct;
}

export interface PropostaReajuste {
  clienteId: string;
  razaoSocial: string;
  indice: Indice | "FIXO";
  percentual: number;
  valorAtual: number;
  valorProposto: number;
  mesAniversario: number;
  contratoId?: string;
}

export async function simularReajustePorCliente(clienteId: string, mesAlvo?: number): Promise<PropostaReajuste | null> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    include: { contratos: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!cliente) return null;
  const contrato = cliente.contratos[0];
  const indice = (cliente.indiceReajuste ?? "IPCA") as Indice | "FIXO";
  const valorAtual = Number(contrato?.valorHonorarios ?? 0);
  if (!valorAtual) return null;

  let percentual = 0;
  if (indice !== "FIXO") {
    percentual = await obterIndiceAcumulado12m(indice);
  }
  const valorProposto = Number((valorAtual * (1 + percentual / 100)).toFixed(2));

  return {
    clienteId: cliente.id,
    razaoSocial: cliente.razaoSocial,
    indice,
    percentual,
    valorAtual,
    valorProposto,
    mesAniversario: mesAlvo ?? cliente.mesAniversarioReajuste ?? new Date().getMonth() + 1,
    contratoId: contrato?.id,
  };
}

/**
 * Varre clientes cujo mês-aniversário é o mês informado (default = mês atual)
 * e retorna propostas de reajuste. Não aplica automaticamente.
 */
export async function gerarPropostasReajuste(mes?: number): Promise<PropostaReajuste[]> {
  const alvo = mes ?? new Date().getMonth() + 1;
  const clientes = await prisma.cliente.findMany({
    where: { status: "ATIVO", mesAniversarioReajuste: alvo },
    select: { id: true },
  });

  const propostas: PropostaReajuste[] = [];
  for (const { id } of clientes) {
    const p = await simularReajustePorCliente(id, alvo);
    if (p) propostas.push(p);
  }
  return propostas;
}

/**
 * Aplica uma proposta — atualiza valorHonorarios do contrato mais recente
 * e grava a data do último reajuste no cliente.
 */
export async function aplicarReajuste(proposta: PropostaReajuste) {
  await prisma.$transaction(async (tx) => {
    if (proposta.contratoId) {
      await tx.contrato.update({
        where: { id: proposta.contratoId },
        data: { valorHonorarios: proposta.valorProposto },
      });
    }
    await tx.cliente.update({
      where: { id: proposta.clienteId },
      data: { ultimoReajuste: new Date() },
    });
  });
}
