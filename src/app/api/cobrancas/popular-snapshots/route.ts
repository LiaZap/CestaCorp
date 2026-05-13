import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { audit } from "@/lib/security/audit";
import { popularSnapshotCobrancas } from "../../../../../scripts/popular-snapshot-cobrancas";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/cobrancas/popular-snapshots
 *
 * Patch idempotente: popula `regraJurosSnapshot` em cobranças legadas (sem snapshot).
 * Patrick (09/05): mudança prospectiva — cobranças antigas precisam congelar a regra atual.
 *
 * Roda 1x ao migrar pra essa feature, ou de novo se aparecerem cobranças órfãs (raro).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  // Só admin pode disparar isso (afeta TODAS as cobranças do banco)
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "ação restrita a administradores" }, { status: 403 });
  }

  try {
    const r = await popularSnapshotCobrancas();
    await audit({
      session,
      action: "cobranca.popular-snapshots",
      resource: "cobranca",
      after: r,
      request: req,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (err: any) {
    return NextResponse.json(
      { error: "falha ao popular snapshots", detalhe: String(err?.message ?? err).slice(0, 300) },
      { status: 500 }
    );
  }
}
