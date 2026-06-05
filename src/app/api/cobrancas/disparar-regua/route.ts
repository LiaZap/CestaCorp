import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { audit } from "@/lib/security/audit";

/**
 * Lote: dispara régua para cobranças (#55).
 * Stub: marca metadados; o agendamento real fica para a thread da régua.
 * Body: { ids: string[] }
 */
const Body = z.object({ ids: z.array(z.string().min(1)).min(1).max(500) });

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const json = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const { ids } = parsed.data;

  await audit({
    session, action: "cobranca.disparar-regua-lote", resource: "cobranca",
    resourceId: ids.join(","), before: null, after: { count: ids.length }, request: req,
  });

  return NextResponse.json({ ok: true, count: ids.length });
}
