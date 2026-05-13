import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { solicitarReset } from "@/lib/services/cliente-auth";
import { rateLimit } from "@/lib/security/rate-limit";

const Schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  // 3 solicitações de reset por IP a cada 10min — evita spam de e-mail e enumeração
  const rl = rateLimit(req, "portal-esqueci", { max: 3, windowMs: 10 * 60_000 });
  if (!rl.ok) return NextResponse.json({ ok: true }, { headers: rl.headers }); // mesmo no limit, não revela

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ ok: true }, { headers: rl.headers });
  try { await solicitarReset(parsed.data.email); } catch {}
  return NextResponse.json({ ok: true }, { headers: rl.headers });
}
