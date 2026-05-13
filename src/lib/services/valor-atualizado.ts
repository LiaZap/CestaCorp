/**
 * Cálculo de valor atualizado de cobranças em atraso.
 *
 * Patrick (28/04/2026, áudio):
 *   "1% de juro ao dia e 2% de multa, padrão pra todo mundo. Se o cliente
 *    fosse pagar hoje, qual o valor atualizado?"
 *
 * Fórmula padrão (juros simples):
 *   valor_atualizado = bruto + (bruto * multa%) + (bruto * juros%/dia * dias_atraso)
 *
 * Com juros compostos (opcional, desligado por padrão):
 *   valor_atualizado = (bruto + multa) * (1 + juros)^dias_atraso
 *
 * Carência: dias antes de começar a cobrar juros (default 0).
 *
 * Configuração lida de ConfigCobranca (single-row, id="default").
 * Se não existir registro, usa default: 1% juros/dia + 2% multa, sem carência.
 */

import { prisma } from "@/lib/db/prisma";

export interface ConfigCobranca {
  jurosPctAoDia: number;   // ex: 1.0 = 1% ao dia
  multaPct: number;        // ex: 2.0 = 2%
  carenciaDias: number;    // ex: 0
  jurosCompostos: boolean; // false = simples (default)
}

export interface ValorAtualizado {
  bruto: number;          // valor original da cobrança
  multa: number;          // R$ multa fixa
  juros: number;          // R$ juros acumulados
  total: number;          // bruto + multa + juros
  diasAtraso: number;     // dias entre vencimento e referência
  emAtraso: boolean;      // true se diasAtraso > carenciaDias
  config: ConfigCobranca;
}

/**
 * Default Cestacorp (confirmado por Patrick 09/05/2026):
 *   - 1% juros ao dia
 *   - 2% multa fixa
 *   - Carência D+3 dias corridos (sáb/dom contam)
 *   - Juros simples (não compostos)
 */
const DEFAULT: ConfigCobranca = {
  jurosPctAoDia: 1.0,
  multaPct: 2.0,
  carenciaDias: 3,
  jurosCompostos: false,
};

/**
 * Cache em memória da config global por 60s.
 *
 * Por quê: listagem de cobranças (dashboard, ficha do cliente) chama
 * `getConfigCobranca()` em loop. Sem cache, vira 1 query por item.
 * Com cache, 1 query por minuto. Mudança via UI invalida com
 * `invalidarCacheConfig()` (single-instance); 60s garante convergência
 * eventual em multi-instância caso suba pra prod com load balancer.
 */
let _cache: { config: ConfigCobranca; em: number } | null = null;
const CACHE_MS = 60_000;

export async function getConfigCobranca(): Promise<ConfigCobranca> {
  if (_cache && Date.now() - _cache.em < CACHE_MS) return _cache.config;

  try {
    const cfg = await prisma.configCobranca.findUnique({ where: { id: "default" } });
    const out: ConfigCobranca = cfg && cfg.ativo
      ? {
          jurosPctAoDia: Number(cfg.jurosPctAoDia),
          multaPct: Number(cfg.multaPct),
          carenciaDias: cfg.carenciaDias,
          jurosCompostos: cfg.jurosCompostos,
        }
      : DEFAULT;
    _cache = { config: out, em: Date.now() };
    return out;
  } catch {
    return DEFAULT;
  }
}

/** Invalida o cache (chamar após salvar nova config). */
export function invalidarCacheConfig() {
  _cache = null;
}

/**
 * Calcula valor atualizado de uma cobrança.
 *
 * @param bruto valor original (R$)
 * @param vencimento data de vencimento
 * @param hoje data de referência (default: agora)
 * @param config opcional — se não passar, busca a config global
 */
export async function calcularValorAtualizado(
  bruto: number,
  vencimento: Date,
  hoje: Date = new Date(),
  configOverride?: ConfigCobranca
): Promise<ValorAtualizado> {
  const config = configOverride ?? await getConfigCobranca();
  return calcularValorAtualizadoSync(bruto, vencimento, hoje, config);
}

/**
 * Extrai ConfigCobranca de um snapshot JSON gravado na Cobranca.
 * Retorna null se o snapshot for inválido ou inexistente.
 *
 * Patrick (09/05): mudança de regra é prospectiva. Cobranças antigas mantêm
 * o snapshot original — mesmo que a config global tenha mudado depois.
 */
export function parseSnapshot(snapshot: any): ConfigCobranca | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const j = snapshot.jurosPctAoDia;
  const m = snapshot.multaPct;
  const c = snapshot.carenciaDias;
  if (j == null || m == null || c == null) return null;
  return {
    jurosPctAoDia: Number(j),
    multaPct: Number(m),
    carenciaDias: Number(c),
    jurosCompostos: Boolean(snapshot.jurosCompostos),
  };
}

/**
 * Calcula usando o snapshot da cobrança (regra do dia em que foi criada).
 * Se a cobrança não tem snapshot (legado), usa a config global atual.
 */
export async function calcularValorAtualizadoComSnapshot(
  bruto: number,
  vencimento: Date,
  snapshot: any,
  hoje: Date = new Date()
): Promise<ValorAtualizado & { regraOrigem: "snapshot" | "global" }> {
  const fromSnap = parseSnapshot(snapshot);
  if (fromSnap) {
    const r = calcularValorAtualizadoSync(bruto, vencimento, hoje, fromSnap);
    return { ...r, regraOrigem: "snapshot" };
  }
  const r = await calcularValorAtualizado(bruto, vencimento, hoje);
  return { ...r, regraOrigem: "global" };
}

/** Versão síncrona — útil quando você já tem a config carregada (lote). */
export function calcularValorAtualizadoSync(
  bruto: number,
  vencimento: Date,
  hoje: Date,
  config: ConfigCobranca
): ValorAtualizado {
  // Normaliza pra início do dia (UTC) pra contar dias corridos
  const venc = new Date(vencimento);
  venc.setHours(0, 0, 0, 0);
  const ref = new Date(hoje);
  ref.setHours(0, 0, 0, 0);

  const diffMs = ref.getTime() - venc.getTime();
  const diasAtraso = Math.max(0, Math.floor(diffMs / 86_400_000));
  const emAtraso = diasAtraso > config.carenciaDias;

  if (!emAtraso) {
    return {
      bruto,
      multa: 0,
      juros: 0,
      total: bruto,
      diasAtraso,
      emAtraso: false,
      config,
    };
  }

  const diasJuros = diasAtraso - config.carenciaDias;

  if (config.jurosCompostos) {
    // composto: (bruto + multa) × (1 + juros/100)^dias
    const multa = bruto * (config.multaPct / 100);
    const base = bruto + multa;
    const fator = Math.pow(1 + config.jurosPctAoDia / 100, diasJuros);
    const total = base * fator;
    const juros = total - base;
    return {
      bruto: arredondar(bruto),
      multa: arredondar(multa),
      juros: arredondar(juros),
      total: arredondar(total),
      diasAtraso,
      emAtraso: true,
      config,
    };
  }

  // simples (padrão): bruto + multa + (bruto × juros% × dias)
  const multa = bruto * (config.multaPct / 100);
  const juros = bruto * (config.jurosPctAoDia / 100) * diasJuros;
  const total = bruto + multa + juros;
  return {
    bruto: arredondar(bruto),
    multa: arredondar(multa),
    juros: arredondar(juros),
    total: arredondar(total),
    diasAtraso,
    emAtraso: true,
    config,
  };
}

function arredondar(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Calcula em lote — útil pra dashboard com 100 cobranças.
 *
 * Cada cobrança pode ter `regraJurosSnapshot` (Patrick 09/05: mudança prospectiva).
 * Se tiver, usa o snapshot. Senão, cai na config global atual (cobranças legadas).
 */
export async function calcularValorAtualizadoLote(
  cobrancas: { id: string; valor: number; vencimento: Date; regraJurosSnapshot?: any }[],
  hoje: Date = new Date()
): Promise<Map<string, ValorAtualizado & { regraOrigem: "snapshot" | "global" }>> {
  const configGlobal = await getConfigCobranca();
  const map = new Map<string, ValorAtualizado & { regraOrigem: "snapshot" | "global" }>();
  for (const c of cobrancas) {
    const fromSnap = parseSnapshot(c.regraJurosSnapshot);
    const cfg = fromSnap ?? configGlobal;
    const r = calcularValorAtualizadoSync(c.valor, c.vencimento, hoje, cfg);
    map.set(c.id, { ...r, regraOrigem: fromSnap ? "snapshot" : "global" });
  }
  return map;
}
