import { NextRequest, NextResponse } from "next/server";
import { rodarReguaDiaria } from "@/lib/services/regua-cobranca";

/**
 * Endpoint para disparar a régua de cobrança.
 * Proteção: header `x-cron-secret` = NEXTAUTH_SECRET (ou secret dedicado).
 * EasyPanel agenda um HTTP call diário para este endpoint.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
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
