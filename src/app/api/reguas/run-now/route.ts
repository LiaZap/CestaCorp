import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { audit } from "@/lib/security/audit";
import { rodarReguaDiaria } from "@/lib/services/regua-cobranca";

/**
 * Roda manualmente a régua diária (fora do cron). Apenas equipe — cliente do
 * portal não pode disparar centenas de mensagens via Digisac (custo + reputação).
 * Reportado em auditoria de seg #7.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); }
  catch (e) { return NextResponse.json({ error: (e as AuthorizationError).message }, { status: 403 }); }

  try {
    const resultado = await rodarReguaDiaria();
    await audit({
      session,
      action: "regua.run-now",
      resource: "regua",
      resourceId: "diaria",
      after: { resultado },
      request: req,
    });
    return NextResponse.redirect(
      new URL("/regua-cobranca?ran=1", req.nextUrl.origin),
      303
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
