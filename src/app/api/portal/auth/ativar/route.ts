import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ativarAcessoComToken } from "@/lib/services/cliente-auth";
import { rateLimit } from "@/lib/security/rate-limit";

const Schema = z.object({ token: z.string().min(10), senha: z.string().min(8) });

export async function POST(req: NextRequest) {
  // 10 ativações em 15min por IP (token já é one-shot; limite extra contra brute force)
  const rl = rateLimit(req, "portal-ativar", { max: 10, windowMs: 15 * 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "muitas tentativas, aguarde alguns minutos" }, { status: 429, headers: rl.headers });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "dados inválidos" }, { status: 400, headers: rl.headers });
  try {
    await ativarAcessoComToken(parsed.data.token, parsed.data.senha);
    return NextResponse.json({ ok: true }, { headers: rl.headers });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 400, headers: rl.headers });
  }
}
