/**
 * A/B testing de templates na régua.
 * Estratégia: round-robin baseado em hash determinístico do (clienteId + cobrancaId + passoId)
 * → mesmo cliente+cobrança sempre recebe a mesma variante (não confunde com trocas).
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/db/prisma";

export type PassoComVariantes = {
  id: string;
  templateMsg: string;
  templateVariantes: unknown;
};

/**
 * Retorna { template, varianteIdx } determinístico.
 * variante 0 = templateMsg original; 1+ = variantes do array.
 */
export function escolherVariante(
  passo: PassoComVariantes,
  seeds: { clienteId: string; cobrancaId?: string | null }
): { template: string; varianteIdx: number; totalVariantes: number } {
  const variantes = Array.isArray(passo.templateVariantes)
    ? (passo.templateVariantes as string[])
    : [];
  const todas = [passo.templateMsg, ...variantes];

  if (todas.length === 1) return { template: todas[0], varianteIdx: 0, totalVariantes: 1 };

  const seed = `${passo.id}:${seeds.clienteId}:${seeds.cobrancaId ?? ""}`;
  const hash = crypto.createHash("sha256").update(seed).digest();
  const idx = hash.readUInt32BE(0) % todas.length;

  return { template: todas[idx], varianteIdx: idx, totalVariantes: todas.length };
}

/**
 * Métricas por variante: quantas foram enviadas, quantas convertenram em pagamento.
 */
export async function getMetricasABPorPasso(passoId: string) {
  const passo = await prisma.reguaPasso.findUnique({ where: { id: passoId } });
  if (!passo) return null;

  const variantes = Array.isArray(passo.templateVariantes)
    ? (passo.templateVariantes as string[])
    : [];
  const qtdVariantes = 1 + variantes.length;
  if (qtdVariantes === 1) return null;

  // Agrupa execuções por variante
  const execs = await prisma.execucaoRegua.findMany({
    where: { passoId, status: { in: ["ENVIADO", "PULADO"] } },
    select: { varianteUsada: true, cobrancaId: true, status: true },
  });

  const porVariante = new Map<number, { enviadas: number; pagas: number }>();
  for (let i = 0; i < qtdVariantes; i++) porVariante.set(i, { enviadas: 0, pagas: 0 });

  const cobrancasEnviadas = new Map<number, Set<string>>();
  for (let i = 0; i < qtdVariantes; i++) cobrancasEnviadas.set(i, new Set());

  for (const e of execs) {
    const v = e.varianteUsada ?? 0;
    if (!porVariante.has(v)) continue;
    if (e.status === "ENVIADO") {
      porVariante.get(v)!.enviadas++;
      if (e.cobrancaId) cobrancasEnviadas.get(v)!.add(e.cobrancaId);
    }
  }

  // Conta quantas cobranças (para quem variante X foi enviada) estão PAGAS
  for (const [v, ids] of cobrancasEnviadas) {
    if (ids.size === 0) continue;
    const pagas = await prisma.cobranca.count({
      where: { id: { in: Array.from(ids) }, status: "PAGO" },
    });
    porVariante.get(v)!.pagas = pagas;
  }

  const labels = ["A (original)", "B", "C", "D", "E"];
  return Array.from(porVariante.entries()).map(([v, stats]) => ({
    variante: v,
    label: labels[v] ?? `V${v}`,
    preview: v === 0 ? passo.templateMsg : variantes[v - 1],
    enviadas: stats.enviadas,
    pagas: stats.pagas,
    conversao: stats.enviadas > 0 ? Math.round((stats.pagas / stats.enviadas) * 100) : 0,
  }));
}
