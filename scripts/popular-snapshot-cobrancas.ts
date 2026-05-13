/**
 * Patrick (09/05/2026): mudança de regra de juros é PROSPECTIVA.
 *   - Cobranças NOVAS já nascem com snapshot via sincronizarCobrancasNibo()
 *   - Cobranças LEGADAS (criadas antes da feature de snapshot) ficam null
 *
 * Este script popula `regraJurosSnapshot` em todas as cobranças que estão null,
 * usando a config global ATUAL como referência (= regra ativa quando o script roda).
 *
 * É idempotente: roda quantas vezes quiser, só toca em quem está null.
 *
 * Uso CLI:
 *   npx tsx scripts/popular-snapshot-cobrancas.ts
 *
 * Uso programático:
 *   import { popularSnapshotCobrancas } from "./popular-snapshot-cobrancas";
 *   const r = await popularSnapshotCobrancas();
 */

import { PrismaClient } from "@prisma/client";

export interface ResultadoPopular {
  total: number;
  jaTinhamSnapshot: number;
  populados: number;
  configUsada: {
    jurosPctAoDia: number;
    multaPct: number;
    carenciaDias: number;
    jurosCompostos: boolean;
  };
}

export async function popularSnapshotCobrancas(prismaArg?: PrismaClient): Promise<ResultadoPopular> {
  const prisma = prismaArg ?? new PrismaClient();

  // Garante que existe config default
  const cfg = await prisma.configCobranca.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  const configUsada = {
    jurosPctAoDia: Number(cfg.jurosPctAoDia),
    multaPct: Number(cfg.multaPct),
    carenciaDias: cfg.carenciaDias,
    jurosCompostos: cfg.jurosCompostos,
  };

  const snapshot = {
    ...configUsada,
    capturadoEm: new Date().toISOString(),
    fonte: "popular-snapshot-cobrancas",
  };

  // Conta antes
  const total = await prisma.cobranca.count();
  // O Prisma com Json? pode falhar em filtros equals:null — usar SQL bruto pra contar
  const semSnapRaw: any[] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM cobrancas WHERE "regraJurosSnapshot" IS NULL`
  );
  const semSnap = semSnapRaw[0]?.n ?? 0;

  // Aplica via raw SQL (Prisma Decimal serializa bem em parametrização)
  const populados: any[] = await prisma.$queryRawUnsafe(
    `UPDATE cobrancas
     SET "regraJurosSnapshot" = $1::jsonb
     WHERE "regraJurosSnapshot" IS NULL
     RETURNING id`,
    JSON.stringify(snapshot),
  );

  if (!prismaArg) await prisma.$disconnect();

  return {
    total,
    jaTinhamSnapshot: total - semSnap,
    populados: populados.length,
    configUsada,
  };
}

// CLI entry point
if (require.main === module) {
  popularSnapshotCobrancas()
    .then((r) => {
      console.log("=== Popular snapshot de cobranças ===");
      console.log(`Total no banco:       ${r.total}`);
      console.log(`Já tinham snapshot:   ${r.jaTinhamSnapshot}`);
      console.log(`Populados agora:      ${r.populados}`);
      console.log("Regra usada (config global atual):");
      console.log(`  Juros: ${r.configUsada.jurosPctAoDia}% ao dia`);
      console.log(`  Multa: ${r.configUsada.multaPct}%`);
      console.log(`  Carência: ${r.configUsada.carenciaDias} dias corridos`);
      console.log(`  Compostos: ${r.configUsada.jurosCompostos}`);
      process.exit(0);
    })
    .catch((e) => {
      console.error("Erro:", e);
      process.exit(1);
    });
}
