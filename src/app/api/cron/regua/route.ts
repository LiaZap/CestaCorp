import { NextRequest, NextResponse } from "next/server";
import { rodarReguaDiaria } from "@/lib/services/regua-cobranca";
import { verificarCronSecret } from "@/lib/security/cron-auth";

/**
 * Endpoint para disparar a régua de cobrança.
 * Proteção: header `x-cron-secret` = CRON_SECRET (dedicado, não compartilha
 * mais com NEXTAUTH_SECRET — auditoria seg #8). EasyPanel agenda HTTP call
 * diário para este endpoint.
 */
export async function POST(req: NextRequest) {
  const erro = verificarCronSecret(req);
  if (erro) return erro;
  try {
    const resultado = await rodarReguaDiaria();
    return NextResponse.json({ ok: true, resultado });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
