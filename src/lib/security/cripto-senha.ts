/**
 * Criptografia de senhas de certificado digital (AES-256-GCM).
 *
 * Modelo:
 *   - ENV: CERTIFICATE_ENCRYPTION_KEY = base64 de 32 bytes (256 bits)
 *   - Saída: "v1:<iv-hex>:<tag-hex>:<ciphertext-hex>"
 *
 * Em DEV sem a key: retorna plaintext com prefixo "plain:" e loga warn.
 * Em PROD sem a key: throw — env-guard já falha o boot, mas defesa em profundidade.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { logger } from "@/lib/logger";

const ALG = "aes-256-gcm";

function getKey(): Buffer | null {
  const b64 = process.env.CERTIFICATE_ENCRYPTION_KEY;
  if (!b64) return null;
  const buf = Buffer.from(b64, "base64");
  if (buf.length !== 32) {
    throw new Error(`CERTIFICATE_ENCRYPTION_KEY precisa decodificar pra 32 bytes (atual: ${buf.length})`);
  }
  return buf;
}

export async function criptografarSenha(plain: string): Promise<string> {
  if (!plain) return "";
  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CERTIFICATE_ENCRYPTION_KEY ausente em produção — abortando criptografia");
    }
    logger.warn("CERTIFICATE_ENCRYPTION_KEY ausente — guardando senha em PLAINTEXT (dev only)");
    return `plain:${plain}`;
  }
  const iv = randomBytes(12); // GCM recomenda 96-bit IV
  const cipher = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

export async function descriptografarSenha(encoded: string): Promise<string> {
  if (!encoded) return "";
  if (encoded.startsWith("plain:")) return encoded.slice(6);
  if (!encoded.startsWith("v1:")) {
    // assume legacy plaintext (pré-criptografia)
    return encoded;
  }
  const key = getKey();
  if (!key) throw new Error("CERTIFICATE_ENCRYPTION_KEY ausente — não dá pra decriptar");

  const [, ivHex, tagHex, ctHex] = encoded.split(":");
  if (!ivHex || !tagHex || !ctHex) throw new Error("Senha criptografada malformada");

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");

  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
