/**
 * Factory de criação de Cobrança — ÚNICO ponto de entrada autorizado.
 *
 * Patrick (09/05/2026) decidiu mudança PROSPECTIVA da regra de juros:
 *   "Cobrança nasce com a regra do dia. Mudança futura só vale pras novas."
 *
 * Pra essa promessa ser real, TODA criação de Cobranca precisa capturar
 * snapshot da config global no momento da criação. Se alguém usar
 * `prisma.cobranca.create()` direto, a cobrança nasce sem snapshot e
 * vira órfã: na primeira mudança de regra, recalcula retroativamente.
 *
 * REGRA DE OURO: chame `criarCobranca()` em todo lugar que cria cobrança.
 * Nunca use `prisma.cobranca.create()` direto, exceto:
 *   - dentro desta factory
 *   - em scripts de retrofill que populam snapshot manualmente
 *   - em testes que mockam Prisma
 *
 * Existe um teste de regressão em tests/unit/cobranca-factory.test.ts que
 * faz grep e falha o build se aparecer `prisma.cobranca.create` em arquivo
 * não-autorizado.
 */

import type { Prisma, Cobranca } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getConfigCobranca, type ConfigCobranca } from "./valor-atualizado";

/** Snapshot que vai pro JSON da Cobranca. */
export interface RegraJurosSnapshot {
  jurosPctAoDia: number;
  multaPct: number;
  carenciaDias: number;
  jurosCompostos: boolean;
  capturadoEm: string;  // ISO timestamp
  fonte: string;         // identifica de onde veio (sync-nibo, seed-demo, manual, etc.)
}

/**
 * Cria snapshot a partir de uma ConfigCobranca + fonte.
 * Exposto pra scripts que populam legado.
 */
export function montarSnapshot(config: ConfigCobranca, fonte: string): RegraJurosSnapshot {
  return {
    jurosPctAoDia: config.jurosPctAoDia,
    multaPct: config.multaPct,
    carenciaDias: config.carenciaDias,
    jurosCompostos: config.jurosCompostos,
    capturadoEm: new Date().toISOString(),
    fonte,
  };
}

/**
 * Input da factory: aceita TODOS os campos da Cobranca exceto `regraJurosSnapshot`,
 * que é sempre derivado. Quem chama não precisa pensar em snapshot.
 */
export type CriarCobrancaInput = Omit<Prisma.CobrancaUncheckedCreateInput, "regraJurosSnapshot">;

export interface CriarCobrancaOpts {
  /** Identificador da fonte (default "factory"). Útil pra debugar de onde nasceu cada cobrança. */
  fonte?: string;
  /**
   * Pra override (raro): forçar uma config específica em vez da global.
   * Útil em backfill onde queremos congelar uma regra histórica conhecida.
   */
  configOverride?: ConfigCobranca;
}

/**
 * Cria UMA cobrança capturando snapshot da regra atual.
 *
 * @example
 * await criarCobranca({
 *   clienteId, valor: 1850, vencimento: new Date("2026-04-25"),
 *   descricao: "Honorário 04/2026", status: "ABERTO",
 * }, { fonte: "sync-nibo" });
 */
export async function criarCobranca(
  data: CriarCobrancaInput,
  opts?: CriarCobrancaOpts,
): Promise<Cobranca> {
  const config = opts?.configOverride ?? await getConfigCobranca();
  const snapshot = montarSnapshot(config, opts?.fonte ?? "factory");

  return prisma.cobranca.create({
    data: {
      ...data,
      regraJurosSnapshot: snapshot as any,
    },
  });
}

/**
 * Cria múltiplas cobranças com o MESMO snapshot — otimização pra lote
 * (1 leitura de config em vez de N).
 *
 * Usa createMany pra performance. Não retorna os registros (usa `count`).
 */
export async function criarCobrancasEmLote(
  itens: CriarCobrancaInput[],
  opts?: CriarCobrancaOpts,
): Promise<{ count: number }> {
  if (itens.length === 0) return { count: 0 };
  const config = opts?.configOverride ?? await getConfigCobranca();
  const snapshot = montarSnapshot(config, opts?.fonte ?? "factory-lote");

  return prisma.cobranca.createMany({
    data: itens.map((d) => ({
      ...d,
      regraJurosSnapshot: snapshot as any,
    })),
  });
}
