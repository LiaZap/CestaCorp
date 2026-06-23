/**
 * Integração Google Drive via Service Account (#15).
 *
 * Patrick (12/06): mandou link da pasta:
 * https://drive.google.com/drive/folders/1lAdksPXH680jDDSxnLwuvGI16ZqK6uM1
 *
 * Como funciona:
 *  - Service Account (JSON colado em GOOGLE_SERVICE_ACCOUNT_JSON) → JWT
 *  - JWT troca por access_token na Google OAuth2 endpoint
 *  - Upload multipart pro Drive API v3 com parent = pasta acima
 *
 * Sem `googleapis` (~80MB) — só REST + jsonwebtoken (~3MB já no projeto).
 *
 * Setup que Patrick precisa fazer no Google Cloud:
 *  1. Criar projeto (ou usar existente)
 *  2. Habilitar Drive API
 *  3. Criar Service Account → gerar chave JSON
 *  4. Copiar o JSON inteiro pro EasyPanel em GOOGLE_SERVICE_ACCOUNT_JSON
 *  5. Compartilhar a pasta com o email da service account (algo tipo
 *     cestacorp-drive@<projeto>.iam.gserviceaccount.com) como "Editor"
 *  6. Setar GOOGLE_DRIVE_FOLDER_ID=1lAdksPXH680jDDSxnLwuvGI16ZqK6uM1
 *
 * Sem essas envs: uploads continuam funcionando local (uploads/<hash>),
 * só não copiam pro Drive — comportamento degradável, não bloqueia o
 * formulário.
 */

import jwt from "jsonwebtoken";
import { logger } from "@/lib/logger";

const SCOPES = "https://www.googleapis.com/auth/drive.file";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function getServiceAccount(): ServiceAccountKey | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.client_email || !parsed.private_key) return null;
    return parsed;
  } catch (err) {
    logger.error("GOOGLE_SERVICE_ACCOUNT_JSON inválido", { err: String(err) });
    return null;
  }
}

export function driveConfigurado(): boolean {
  return Boolean(getServiceAccount() && process.env.GOOGLE_DRIVE_FOLDER_ID);
}

/**
 * Pega access_token via JWT grant — cacheia até 5min antes de expirar.
 */
async function obterAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60_000) {
    return cachedToken.token;
  }

  const sa = getServiceAccount();
  if (!sa) throw new Error("Service account não configurada");

  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      scope: SCOPES,
      aud: sa.token_uri ?? TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
    { algorithm: "RS256" },
  );

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Token Drive falhou: ${res.status} ${txt.slice(0, 200)}`);
  }
  const j = await res.json() as { access_token: string; expires_in: number };
  cachedToken = {
    token: j.access_token,
    expiresAt: Date.now() + (j.expires_in * 1000),
  };
  return j.access_token;
}

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
  name: string;
}

/**
 * Faz upload via Drive REST API v3 multipart.
 *
 * - `parentFolderId` override do GOOGLE_DRIVE_FOLDER_ID (ex: subpasta por cliente)
 * - `subfolderName` opcional cria/usa subpasta dentro do parent
 */
export async function uploadParaDrive(params: {
  buffer: Buffer;
  filename: string;
  mime: string;
  parentFolderId?: string;
  subfolderName?: string;
}): Promise<DriveUploadResult> {
  if (!driveConfigurado()) {
    throw new Error("Drive não configurado (GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_DRIVE_FOLDER_ID)");
  }

  const token = await obterAccessToken();
  let parent = params.parentFolderId ?? process.env.GOOGLE_DRIVE_FOLDER_ID!;

  if (params.subfolderName) {
    parent = await garantirSubpasta(token, parent, params.subfolderName);
  }

  // Multipart: metadata + bytes
  const boundary = "boundary-" + Math.random().toString(36).slice(2);
  const metadata = JSON.stringify({
    name: params.filename,
    parents: [parent],
    mimeType: params.mime,
  });
  const header =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${params.mime}\r\n\r\n`;
  const footer = `\r\n--${boundary}--`;

  const body = Buffer.concat([
    Buffer.from(header, "utf8"),
    params.buffer,
    Buffer.from(footer, "utf8"),
  ]);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: body as any,
    },
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Upload Drive falhou: ${res.status} ${txt.slice(0, 300)}`);
  }

  const j = await res.json() as { id: string; name: string; webViewLink: string };
  return { fileId: j.id, name: j.name, webViewLink: j.webViewLink };
}

/**
 * Procura subpasta com o nome dentro do parent. Cria se não existir.
 * Cacheia em memória pra reduzir chamadas.
 */
const subfolderCache = new Map<string, string>();

async function garantirSubpasta(token: string, parent: string, nome: string): Promise<string> {
  const cacheKey = `${parent}/${nome}`;
  const cached = subfolderCache.get(cacheKey);
  if (cached) return cached;

  // Busca primeiro
  const q = `'${parent}' in parents and name='${nome.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const findUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`;

  const findRes = await fetch(findUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (findRes.ok) {
    const data = await findRes.json() as { files: { id: string }[] };
    if (data.files && data.files.length > 0) {
      subfolderCache.set(cacheKey, data.files[0].id);
      return data.files[0].id;
    }
  }

  // Cria
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: nome,
      parents: [parent],
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!createRes.ok) {
    const txt = await createRes.text().catch(() => "");
    throw new Error(`Criar subpasta Drive falhou: ${createRes.status} ${txt.slice(0, 200)}`);
  }
  const j = await createRes.json() as { id: string };
  subfolderCache.set(cacheKey, j.id);
  return j.id;
}
