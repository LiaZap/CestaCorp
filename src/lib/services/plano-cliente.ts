/**
 * Helpers de PlanoCliente (#90 + #99).
 *
 * Patrick (reunião 05/06 16:00): "no nibo é um valor só de faturamento,
 * mas dentro tá aberto dizendo gestão é tanto mais contabilidade tanto
 * somando tudo isso dá um valor só". Esta função é a fonte da verdade
 * pra "qual valor mensal somar pro cliente no NIBO".
 */

import { prisma } from "@/lib/db/prisma";

/**
 * Soma os planos ATIVOS do cliente. Não inclui suspensos ou cancelados.
 * Retorna 0 se cliente não tem planos.
 */
export async function valorMensalPlanosAtivos(clienteId: string): Promise<number> {
  const planos = await prisma.planoCliente.findMany({
    where: { clienteId, status: "ATIVO" },
    select: { valorMensal: true },
  });
  return planos.reduce((acc, p) => acc + Number(p.valorMensal), 0);
}

export interface DetalhePlanos {
  total: number;
  porPlano: Array<{ servicoNome: string; valor: number }>;
}

/**
 * Quebra detalhada (pra mostrar no card "Detalhamento" ao expandir).
 */
export async function detalhePlanosAtivos(clienteId: string): Promise<DetalhePlanos> {
  const planos = await prisma.planoCliente.findMany({
    where: { clienteId, status: "ATIVO" },
    include: { servico: { select: { nome: true } } },
  });
  const porPlano = planos.map((p) => ({ servicoNome: p.servico.nome, valor: Number(p.valorMensal) }));
  return {
    total: porPlano.reduce((acc, p) => acc + p.valor, 0),
    porPlano,
  };
}
