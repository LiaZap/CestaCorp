import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resetarSenhaComToken } from "@/lib/services/cliente-auth";
import { rateLimit } from "@/lib/security/rate-limit";

const Schema = z.object({ token: z.string().min(10), senha: z.string().min(8) });

export async function POST(req: NextRequest) {
  const rl = rateLimit(req, "portal-resetar", { max: 10, windowMs: 15 * 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "muitas tentativas" }, { status: 429, headers: rl.headers });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "dados inválidos" }, { status: 400, headers: rl.headers });
  try {
    await resetarSenhaComToken(parsed.data.token, parsed.data.senha);
    return NextResponse.json({ ok: true }, { headers: rl.headers });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 400, headers: rl.headers });
  }
}
