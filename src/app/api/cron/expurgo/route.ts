import { NextRequest, NextResponse } from "next/server";
import { rodarExpurgoMensal } from "@/lib/services/expurgo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron mensal de expurgo. Protegido pelo mesmo x-cron-secret da régua.
 * EasyPanel: agenda `POST /api/cron/expurgo` todo dia 1 às 03:00.
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const resultados = await rodarExpurgoMensal();
    return NextResponse.json({ ok: true, resultados });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) { return POST(req); }
