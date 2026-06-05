/**
 * Autenticação de endpoints de cron via header `x-cron-secret`.
 *
 * Historicamente compartilhávamos `NEXTAUTH_SECRET` como bearer de cron
 * (auditoria #8). Vazar isso = poder forjar JWTs de admin. Agora usamos
 * `CRON_SECRET` dedicado e comparação em tempo constante.
 *
 * Aceita fallback pra `NEXTAUTH_SECRET` apenas em dev — pra que ambientes
 * locais antigos continuem funcionando até atualizarem o .env.
 */
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length === 0 || bb.length === 0 || ba.length !== bb.length) return false;
  try { return crypto.timingSafeEqual(ba, bb); }
  catch { return false; }
}

/**
 * Valida o header `x-cron-secret`. Em dev, aceita também NEXTAUTH_SECRET
 * (compatibilidade). Em produção exige CRON_SECRET dedicado.
 *
 * Retorna `null` se OK, ou um NextResponse com 401 se inválido.
 */
export function verificarCronSecret(req: NextRequest): NextResponse | null {
  const recebido = req.headers.get("x-cron-secret") ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";

  // Em produção, CRON_SECRET é obrigatório (env-guard impede subir sem).
  if (process.env.NODE_ENV === "production") {
    if (!cronSecret) {
      // Não devia chegar aqui (env-guard rejeita boot), mas defesa em profundidade.
      return NextResponse.json({ error: "cron secret não configurado" }, { status: 503 });
    }
    if (!timingSafeEqualStr(recebido, cronSecret)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return null;
  }

  // Dev: aceita CRON_SECRET OU NEXTAUTH_SECRET (compat com configs antigas).
  if (cronSecret && timingSafeEqualStr(recebido, cronSecret)) return null;
  const authSecret = process.env.NEXTAUTH_SECRET ?? "";
  if (authSecret && timingSafeEqualStr(recebido, authSecret)) return null;

  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
