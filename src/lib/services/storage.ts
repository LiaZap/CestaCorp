/**
 * Storage adapter com fallback filesystem → S3.
 *
 * Se `S3_BUCKET` estiver definido, usa S3 (via @aws-sdk/client-s3).
 * Senão, grava em `uploads/` com SHA256 no nome.
 *
 * Sempre retorna URLs servidas por `/api/files/[id]` para manter auth + escopo.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Import dinâmico que escapa da análise estática do webpack — só resolve
// em runtime quando a dep está realmente instalada.
const dynamicImport = new Function("m", "return import(m)") as (m: string) => Promise<any>;

export interface UploadedFile {
  id: string;            // SHA256 do conteúdo (idempotente)
  url: string;           // URL interna /api/files/[id]
  nome: string;          // nome original
  mime: string;
  tamanho: number;
  backend: "filesystem" | "s3";
}

const MAX_SIZE = 15 * 1024 * 1024; // 15 MB

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function getBaseDir(): string {
  return path.join(process.cwd(), "uploads");
}

export async function uploadArquivo(file: {
  name: string;
  mime: string;
  buffer: Buffer;
  ownerId?: string;   // clienteId ou userId, para controle
  ownerType?: "cliente" | "user" | "system";
}): Promise<UploadedFile> {
  if (file.buffer.length > MAX_SIZE) {
    throw new Error(`Arquivo muito grande (máx ${MAX_SIZE / 1024 / 1024}MB)`);
  }

  const id = sha256(file.buffer);
  const ext = path.extname(file.name).toLowerCase();

  // Backend: S3 se configurado
  const useS3 = Boolean(process.env.S3_BUCKET && process.env.S3_REGION);

  if (useS3) {
    // import dinâmico para não quebrar build sem dep instalada
    const { S3Client, PutObjectCommand } = await dynamicImport("@aws-sdk/client-s3").catch(() => ({ S3Client: null, PutObjectCommand: null } as any));
    if (!S3Client) throw new Error("@aws-sdk/client-s3 não instalado — rode npm i @aws-sdk/client-s3");

    const s3 = new S3Client({
      region: process.env.S3_REGION,
      credentials: process.env.S3_ACCESS_KEY_ID ? {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      } : undefined,
      endpoint: process.env.S3_ENDPOINT, // pra MinIO
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    });
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: `${id}${ext}`,
      Body: file.buffer,
      ContentType: file.mime,
    }));
  } else {
    const baseDir = getBaseDir();
    fs.mkdirSync(baseDir, { recursive: true });
    fs.writeFileSync(path.join(baseDir, `${id}${ext}`), file.buffer);
  }

  // (Metadata em tabela dedicada ficará como opcional — por ora retornamos o hash
  //  que já identifica unicamente o arquivo por conteúdo.)

  return {
    id,
    url: `/api/files/${id}${ext}`,
    nome: file.name,
    mime: file.mime,
    tamanho: file.buffer.length,
    backend: useS3 ? "s3" : "filesystem",
  };
}

export async function lerArquivo(id: string, ext: string): Promise<{ buffer: Buffer; mime: string } | null> {
  const useS3 = Boolean(process.env.S3_BUCKET && process.env.S3_REGION);
  if (useS3) {
    const { S3Client, GetObjectCommand } = await dynamicImport("@aws-sdk/client-s3").catch(() => ({ S3Client: null, GetObjectCommand: null } as any));
    if (!S3Client) return null;
    const s3 = new S3Client({
      region: process.env.S3_REGION,
      credentials: process.env.S3_ACCESS_KEY_ID ? {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      } : undefined,
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    });
    try {
      const r = await s3.send(new GetObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: `${id}${ext}`,
      }));
      const buffer = Buffer.from(await (r.Body as any).transformToByteArray());
      return { buffer, mime: r.ContentType ?? "application/octet-stream" };
    } catch { return null; }
  }
  const p = path.join(getBaseDir(), `${id}${ext}`);
  if (!fs.existsSync(p)) return null;
  return { buffer: fs.readFileSync(p), mime: inferMime(ext) };
}

function inferMime(ext: string): string {
  const m: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return m[ext.toLowerCase()] ?? "application/octet-stream";
}
