/**
 * Helper de resposta de erro com leak prevention (#27).
 *
 * Em produção: retorna apenas `{ error: "internal error" }`. O detalhe vai
 * pro logger no servidor (stderr) com correlation id pra debugging.
 *
 * Em dev/test: retorna a mensagem original pra desenvolvedor ver na tela.
 *
 * NUNCA exponha stack trace, mensagens do Prisma com nomes de tabela,
 * mensagens do banco com hostnames internos, etc.
 *
 * USO:
 *   try { … } catch (err) { return errorResponse(err, "ao criar cliente"); }
 *
 * Para erros esperados (validação, 4xx) NÃO usar este helper — passe
 * mensagem segura direto via NextResponse.json({ error: "..." }, { status: 400 }).
 */
import { NextResponse } from "next/server";
import crypto from "node:crypto";

export interface ErrorResponseOptions {
  status?: number;
  /** Contexto pra log (ex.: "ao criar cliente"). Não aparece pro usuário em prod. */
  context?: string;
}

const PROD_MSG = "internal error";

export function errorResponse(
  err: unknown,
  contextOrOpts: string | ErrorResponseOptions = {},
): NextResponse {
  const opts: ErrorResponseOptions =
    typeof contextOrOpts === "string" ? { context: contextOrOpts } : contextOrOpts;
  const status = opts.status ?? 500;
  const incidentId = crypto.randomBytes(6).toString("hex");

  const msg = err instanceof Error ? err.message : String(err ?? "unknown");
  const ctx = opts.context ? ` [${opts.context}]` : "";

  // Log SEMPRE no servidor — independente de prod ou dev
  // eslint-disable-next-line no-console
  console.error(`[error-response]${ctx} id=${incidentId}`, err);

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: PROD_MSG, incidentId },
      { status },
    );
  }
  return NextResponse.json(
    { error: msg, incidentId, context: opts.context },
    { status },
  );
}
