import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { gerarPropostasReajuste, aplicarReajuste, simularReajustePorCliente } from "@/lib/services/reajuste";
import { assertEquipe, assertAdmin, AuthorizationError } from "@/lib/security/ownership";
import { audit } from "@/lib/security/audit";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const mes = Number(req.nextUrl.searchParams.get("mes")) || undefined;
  const propostas = await gerarPropostasReajuste(mes);
  return NextResponse.json({ mes: mes ?? new Date().getMonth() + 1, propostas });
}

const AplicarSchema = z.object({
  clienteId: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Aplicar reajuste é ação sensível — só ADMIN pode
  try { assertAdmin(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const parsed = AplicarSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const proposta = await simularReajustePorCliente(parsed.data.clienteId);
  if (!proposta) return NextResponse.json({ error: "Sem dados" }, { status: 400 });
  await aplicarReajuste(proposta);
  await audit({
    session,
    action: "reajuste.aplicar",
    resource: "cliente",
    resourceId: parsed.data.clienteId,
    after: {
      indice: proposta.indice,
      percentual: proposta.percentual,
      valorAtual: proposta.valorAtual,
      valorProposto: proposta.valorProposto,
    },
    request: req,
  });
  return NextResponse.json({ ok: true, proposta });
}
