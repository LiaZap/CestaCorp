import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { consultarCnpj } from "@/lib/services/cnpj-lookup";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * GET /api/clientes/consultar-cnpj?cnpj=11222333000181
 *
 * Consulta dados públicos do CNPJ (BrasilAPI → fallback ReceitaWS).
 * Retorna razão social, endereço, sócios, situação, CNAE, etc.
 *
 * Rate limit: 30 consultas/min por usuário (BrasilAPI tem limite gratuito).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const rl = rateLimit(req, "cnpj-lookup", { max: 30, windowMs: 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "muitas consultas — aguarde 1 minuto" },
      { status: 429, headers: rl.headers }
    );
  }

  const { searchParams } = new URL(req.url);
  const cnpj = searchParams.get("cnpj");
  if (!cnpj) return NextResponse.json({ error: "cnpj obrigatório" }, { status: 400 });

  try {
    const dados = await consultarCnpj(cnpj);
    return NextResponse.json(dados);
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message ?? err).slice(0, 200) },
      { status: 502 }
    );
  }
}
