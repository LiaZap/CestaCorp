import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

/**
 * Devolve o próximo código sequencial pra um novo cliente.
 *
 * Regra: pega o maior `codigo` cadastrado e soma 1.
 * Se não tiver nenhum cliente, começa do 1.
 *
 * Compatível com a V-106: o `codigo` é a chave do sistema principal de
 * contabilidade da Cestacorp. Patrick: "o próximo é 257, depois 258, etc."
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const ultimo = await prisma.cliente.aggregate({
    _max: { codigo: true },
  });

  const proximo = (ultimo._max.codigo ?? 0) + 1;

  return NextResponse.json({ proximo, ultimo: ultimo._max.codigo ?? null });
}
