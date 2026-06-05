import { NextRequest, NextResponse } from "next/server";
import { rodarExpurgoMensal } from "@/lib/services/expurgo";
import { verificarCronSecret } from "@/lib/security/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron mensal de expurgo. Protegido pelo CRON_SECRET dedicado.
 * EasyPanel: agenda `POST /api/cron/expurgo` todo dia 1 às 03:00.
 */
export async function POST(req: NextRequest) {
  const erro = verificarCronSecret(req);
  if (erro) return erro;
  try {
    const resultados = await rodarExpurgoMensal();
    return NextResponse.json({ ok: true, resultados });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) { return POST(req); }
