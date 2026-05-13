import { NextRequest, NextResponse } from "next/server";
import { processarAniversariosDoDia } from "@/lib/services/aniversarios";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET/POST /api/cron/aniversarios
 *
 * Disparo diário (recomendado: 09:00). EasyPanel scheduler:
 *   curl -H "x-cron-secret: $NEXTAUTH_SECRET" https://cestacorp.com.br/api/cron/aniversarios
 *
 * Query params:
 *   ?dry=1   → simula sem enviar (lista quem completaria aniversário hoje)
 *   ?data=2026-08-15 → testa com data específica
 */
async function handler(req: NextRequest) {
  // Auth via header secreto (mesma estratégia do /api/cron/regua)
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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
