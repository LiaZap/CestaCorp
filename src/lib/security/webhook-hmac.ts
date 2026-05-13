/**
 * Verificação HMAC SHA256 para webhooks externos.
 * Usa timing-safe comparison para evitar timing attacks.
 */
import crypto from "node:crypto";

export function calcularHmac(body: string | Buffer, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export function verificarHmac(params: {
  body: string | Buffer;
  signature: string | null | undefined;
  secret: string | undefined;
  /**
   * Em dev, se secret não estiver configurado, aceita (permite testar sem HMAC).
   * Em produção deve ser false.
   */
  permitirSemSecret?: boolean;
  /** Prefixo opcional (ex: "sha256=") a ser removido da assinatura antes de comparar */
  prefixo?: string;
}): boolean {
  const { body, signature, secret, permitirSemSecret = false, prefixo = "" } = params;

  if (!secret) {
    if (permitirSemSecret) return true;
    return false;
  }
  if (!signature) return false;

  const sig = prefixo && signature.startsWith(prefixo) ? signature.slice(prefixo.length) : signature;
  const esperado = calcularHmac(body, secret);

  // Comparação em tempo constante
  const a = Buffer.from(esperado, "hex");
  const b = Buffer.from(sig, "hex");
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(a, b); }
  catch { return false; }
}
