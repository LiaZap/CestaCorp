import { NextRequest, NextResponse } from "next/server";
import { processarAniversariosDoDia } from "@/lib/services/aniversarios";
import { logger } from "@/lib/logger";
import { verificarCronSecret } from "@/lib/security/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET/POST /api/cron/aniversarios
 *
 * Disparo diário (recomendado: 09:00). EasyPanel scheduler:
 *   curl -H "x-cron-secret: $CRON_SECRET" https://cestacorp.bahflash.tech/api/cron/aniversarios
 *
 * Query params:
 *   ?dry=1   → simula sem enviar (lista quem completaria aniversário hoje)
 *   ?data=2026-08-15 → testa com data específica
 */
async function handler(req: NextRequest) {
  // Auth via x-cron-secret dedicado (auditoria seg #8).
  const erro = verificarCronSecret(req);
  if (erro) return erro;

  const { searchParams } = new URL(req.url);
  const dryRun = searchParams.get("dry") === "1";
  const dataParam = searchParams.get("data");
  const hoje = dataParam ? new Date(dataParam) : new Date();

  try {
    const r = await processarAniversariosDoDia({ hoje, dryRun });
    logger.info("Cron aniversários", {
      dryRun,
      hoje: r.hoje,
      sociosEnviados: r.socios.enviados,
      empresasEnviadas: r.empresas.enviados,
    });
    return NextResponse.json({ ok: true, dryRun, ...r });
  } catch (err: any) {
    logger.error("Cron aniversários falhou", { err: String(err?.message ?? err) });
    return NextResponse.json(
      { error: "falha no cron", detalhe: String(err?.message ?? err).slice(0, 300) },
      { status: 500 }
    );
  }
}

export const GET = handler;
export const POST = handler;
