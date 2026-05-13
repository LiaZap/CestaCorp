/**
 * Assinatura digital — wrapper com suporte a Autentique (preferido), ClickSign e mock.
 *
 * Em produção:
 *   - AUTENTIQUE_TOKEN configurado → usa Autentique (GraphQL v2)
 *   - Senão CLICKSIGN_ACCESS_TOKEN configurado → usa ClickSign (REST v1)
 *   - Senão → modo mock, gera link fake e simula ciclo
 *
 * Fluxo:
 *   1. enviarParaAssinatura(contratoId, signers[]) → provider cria documento, devolve URL
 *   2. Cliente assina → webhook do provider chama /api/webhooks/autentique (ou /assinatura)
 *   3. Sistema atualiza contrato.assinaturaStatus = ASSINADO
 */

import axios from "axios";
import crypto from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import {
  createDocument as autentiqueCreate,
  getDocument as autentiqueGet,
  calcularStatus,
  getAutentiqueConfig,
} from "./autentique";

export interface Assinante {
  nome: string;
  email: string;
  cpf?: string;
  telefone?: string;
}

export type Provider = "autentique" | "clicksign" | "mock";

export interface EnvioAssinaturaResult {
  provider: Provider;
  docId: string;
  url: string;
  expires?: Date;
  /**
   * Para Autentique, cada signatário tem um link próprio (short_link).
   * `url` é o do primeiro signatário; `signaturasUrls` mapeia email → link.
   */
  signaturasUrls?: Record<string, string>;
}

export function provider(): Provider {
  if (getAutentiqueConfig().enabled) return "autentique";
  if (process.env.CLICKSIGN_ACCESS_TOKEN) return "clicksign";
  return "mock";
}

export async function enviarParaAssinatura(params: {
  contratoId: string;
  filePath: string;       // caminho local do .pdf
  fileName?: string;
  signers: Assinante[];
  mensagem?: string;
}): Promise<EnvioAssinaturaResult> {
  const p = provider();
  if (p === "autentique") return enviarAutentique(params);
  if (p === "clicksign") return enviarClickSign(params);
  return enviarMock(params);
}

// ==========================================================
// AUTENTIQUE (preferido)
// ==========================================================
async function enviarAutentique(params: {
  contratoId: string;
  filePath: string;
  fileName?: string;
  signers: Assinante[];
  mensagem?: string;
}): Promise<EnvioAssinaturaResult> {
  const fs = await import("node:fs");
  const path = await import("node:path");

  const pdfBuffer = fs.readFileSync(params.filePath);
  const filename = params.fileName ?? path.basename(params.filePath);

  // Busca info do contrato pra dar nome bonito ao documento
  const contrato = await prisma.contrato.findUnique({
    where: { id: params.contratoId },
    include: { cliente: { select: { razaoSocial: true, nomeFantasia: true } } },
  });
  const nomeCliente = contrato?.cliente?.nomeFantasia ?? contrato?.cliente?.razaoSocial ?? "Cliente";

  const doc = await autentiqueCreate({
    name: `${contrato?.numero ?? "Contrato"} — ${nomeCliente}`,
    filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
    pdf: pdfBuffer,
    folder: "Cestacorp",
    message: params.mensagem ?? `Olá! Por favor assine o contrato com a Cestacorp.`,
    signers: params.signers.map((s) => ({
      email: s.email,
      name: s.nome,
      action: "SIGN",
    })),
  });

  // Autentique gera 1 short_link por signatário. Pegamos o primeiro como `url` principal.
  const links: Record<string, string> = {};
  for (const sig of doc.signatures) {
    if (sig.link?.short_link) links[sig.email] = sig.link.short_link;
  }
  const primeiroLink = Object.values(links)[0] ?? "";

  await prisma.contrato.update({
    where: { id: params.contratoId },
    data: {
      assinaturaStatus: "AGUARDANDO",
      assinaturaProvider: "autentique",
      assinaturaDocId: doc.id,
      assinaturaUrl: primeiroLink,
      assinaturaEnviadoEm: new Date(),
      assinaturaAssinantes: params.signers.map((s) => ({
        ...s,
        status: "AGUARDANDO",
        link: links[s.email] ?? null,
      })) as any,
    },
  });

  return {
    provider: "autentique",
    docId: doc.id,
    url: primeiroLink,
    signaturasUrls: links,
    expires: new Date(Date.now() + 30 * 86400_000),
  };
}

// ==========================================================
// CLICKSIGN (fallback)
// ==========================================================
async function enviarClickSign(params: {
  contratoId: string;
  filePath: string;
  fileName?: string;
  signers: Assinante[];
}): Promise<EnvioAssinaturaResult> {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const token = process.env.CLICKSIGN_ACCESS_TOKEN!;
  const base = process.env.CLICKSIGN_API_URL || "https://api.clicksign.com/api/v1";

  const conteudo = fs.readFileSync(params.filePath).toString("base64");
  const filename = params.fileName ?? path.basename(params.filePath);
  const http = axios.create({ baseURL: base, timeout: 20_000 });

  const doc = await http.post(`/documents?access_token=${token}`, {
    document: {
      path: `/${filename}`,
      content_base64: `data:application/pdf;base64,${conteudo}`,
      deadline_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
    },
  });
  const docKey = doc.data?.document?.key;

  for (const s of params.signers) {
    const signer = await http.post(`/signers?access_token=${token}`, {
      signer: {
        email: s.email,
        name: s.nome,
        phone_number: s.telefone,
        documentation: s.cpf,
        auths: ["email"],
      },
    });
    await http.post(`/lists?access_token=${token}`, {
      list: {
        document_key: docKey,
        signer_key: signer.data?.signer?.key,
        sign_as: "contractor",
        message: "Assine o contrato de prestação de serviços com a Cestacorp.",
      },
    });
  }

  const url = `https://app.clicksign.com/sign/${docKey}`;

  await prisma.contrato.update({
    where: { id: params.contratoId },
    data: {
      assinaturaStatus: "AGUARDANDO",
      assinaturaProvider: "clicksign",
      assinaturaDocId: docKey,
      assinaturaUrl: url,
      assinaturaEnviadoEm: new Date(),
      assinaturaAssinantes: params.signers.map((s) => ({ ...s, status: "AGUARDANDO" })) as any,
    },
  });

  return { provider: "clicksign", docId: docKey, url };
}

// ==========================================================
// MOCK (dev/demo)
// ==========================================================
async function enviarMock(params: {
  contratoId: string;
  signers: Assinante[];
}): Promise<EnvioAssinaturaResult> {
  const docId = "mock-" + crypto.randomBytes(6).toString("hex");
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const url = `${base}/assinatura-mock/${docId}?contrato=${params.contratoId}`;

  await prisma.contrato.update({
    where: { id: params.contratoId },
    data: {
      assinaturaStatus: "AGUARDANDO",
      assinaturaProvider: "mock",
      assinaturaDocId: docId,
      assinaturaUrl: url,
      assinaturaEnviadoEm: new Date(),
      assinaturaAssinantes: params.signers.map((s) => ({ ...s, status: "AGUARDANDO" })) as any,
    },
  });

  return { provider: "mock", docId, url, expires: new Date(Date.now() + 30 * 86400_000) };
}

// ==========================================================
// Confirmação de assinatura (chamado por webhook ou mock)
// ==========================================================
export async function confirmarAssinatura(contratoId: string, assinantesAtualizados?: Assinante[]) {
  await prisma.contrato.update({
    where: { id: contratoId },
    data: {
      assinaturaStatus: "ASSINADO",
      assinaturaAssinadoEm: new Date(),
      status: "ASSINADO",
      dataAssinatura: new Date(),
      ...(assinantesAtualizados ? { assinaturaAssinantes: assinantesAtualizados as any } : {}),
    },
  });
}

// ==========================================================
// Sincronização ativa (polling) — útil pra rodar de tempo em tempo
// ou ser chamada manualmente pra atualizar o status do contrato.
// ==========================================================
export async function sincronizarStatusAutentique(contratoId: string) {
  const contrato = await prisma.contrato.findUnique({
    where: { id: contratoId },
    select: { assinaturaProvider: true, assinaturaDocId: true },
  });

  if (!contrato || contrato.assinaturaProvider !== "autentique" || !contrato.assinaturaDocId) {
    return { atualizado: false, motivo: "não-é-autentique" };
  }

  const doc = await autentiqueGet(contrato.assinaturaDocId);
  if (!doc) return { atualizado: false, motivo: "doc-não-encontrado" };

  const status = calcularStatus(doc);

  const data: any = {
    assinaturaAssinantes: doc.signatures.map((s) => ({
      nome: s.name,
      email: s.email,
      status: s.signed
        ? "ASSINADO"
        : s.rejected
        ? "REJEITADO"
        : s.viewed
        ? "VISUALIZADO"
        : "AGUARDANDO",
      assinadoEm: s.signed?.created_at,
      visualizadoEm: s.viewed?.created_at,
      rejeitadoEm: s.rejected?.created_at,
      link: s.link?.short_link,
    })) as any,
  };

  if (status === "assinado") {
    data.assinaturaStatus = "ASSINADO";
    data.assinaturaAssinadoEm = new Date();
    data.status = "ASSINADO";
    data.dataAssinatura = new Date();
  } else if (status === "rejeitado") {
    data.assinaturaStatus = "REJEITADO";
  }

  await prisma.contrato.update({ where: { id: contratoId }, data });
  return { atualizado: true, status };
}
