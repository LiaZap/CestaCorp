/**
 * Renomeia em lote PDFs de nota fiscal. Patrick (13/06 WhatsApp):
 * "subiria os PDFs e ele identifica o tomador e a data de emissão pra
 *  renomear pra NOME COMPLETO DO TOMADOR DDMMAAAA.pdf"
 *
 * Entrada:  multipart/form-data com N campos `files`
 * Saída:    application/zip com todos os PDFs renomeados + relatorio.csv
 *           listando original × novoNome × status × motivo.
 *
 * Limites:
 *   - até 30 PDFs por lote (cada um vira chamada Claude vision separada)
 *   - 10 MB por PDF
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { rateLimit } from "@/lib/security/rate-limit";
import { renomearPdfNotaFiscal, type RenomearResultado } from "@/lib/services/renomear-nf";
import { csvEscape } from "@/lib/security/csv";
import { errorResponse } from "@/lib/security/error-response";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — bateria de OCRs

const MAX_ARQUIVOS = 30;
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // Auth + rate-limit (OCR é caro — bate em Claude API)
  const rl = rateLimit(req, "ocr-batch", { max: 5, windowMs: 10 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "muitos lotes em pouco tempo, aguarde" }, { status: 429, headers: rl.headers });
  }
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: rl.headers });
  try { assertEquipe(session); }
  catch (e) { return NextResponse.json({ error: (e as AuthorizationError).message }, { status: 403, headers: rl.headers }); }

  let form: FormData;
  try { form = await req.formData(); }
  catch (e: any) {
    return NextResponse.json({ error: "form-data inválido" }, { status: 400, headers: rl.headers });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "envie pelo menos 1 arquivo no campo `files`" }, { status: 400, headers: rl.headers });
  }
  if (files.length > MAX_ARQUIVOS) {
    return NextResponse.json({ error: `máximo ${MAX_ARQUIVOS} arquivos por lote` }, { status: 400, headers: rl.headers });
  }
  for (const f of files) {
    if (f.size > MAX_BYTES) {
      return NextResponse.json({ error: `${f.name}: maior que ${MAX_BYTES / 1024 / 1024}MB` }, { status: 400, headers: rl.headers });
    }
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") {
      return NextResponse.json({ error: `${f.name}: apenas PDF aceito` }, { status: 400, headers: rl.headers });
    }
  }

  // Roda OCR/renomeação por arquivo (sequencial pra não estourar rate-limit do Claude)
  const resultados: RenomearResultado[] = [];
  const buffers = new Map<string, Buffer>();
  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    buffers.set(f.name, buf);
    try {
      const r = await renomearPdfNotaFiscal(buf, f.name);
      resultados.push(r);
    } catch (e: any) {
      resultados.push({
        arquivoOriginal: f.name,
        novoNome: f.name,
        confianca: 0,
        status: "erro",
        motivo: `falha inesperada: ${String(e?.message ?? e).slice(0, 200)}`,
      });
    }
  }

  // Monta ZIP de saída — PDFs renomeados + relatorio.csv
  let JSZip: any;
  try {
    const dynamicImport = new Function("m", "return import(m)") as (m: string) => Promise<any>;
    const mod = await dynamicImport("jszip");
    JSZip = mod.default ?? mod;
  } catch {
    return errorResponse(new Error("jszip não instalado"), "jszip-missing");
  }

  const zip = new JSZip();
  // Evita colisão de nomes (renomeia múltiplos PDFs pro mesmo nome — adiciona suffix)
  const contadorNome = new Map<string, number>();
  for (const r of resultados) {
    const buf = buffers.get(r.arquivoOriginal);
    if (!buf) continue;
    let nome = r.novoNome;
    const usados = contadorNome.get(nome) ?? 0;
    if (usados > 0) {
      // "FULANO 01012025.pdf" → "FULANO 01012025 (2).pdf"
      nome = nome.replace(/\.pdf$/i, ` (${usados + 1}).pdf`);
    }
    contadorNome.set(r.novoNome, usados + 1);
    zip.file(nome, buf);
  }

  // CSV de relatório (com csvEscape pra não cair em injeção de fórmula em Excel)
  const csvLinhas: string[] = ["arquivo_original;novo_nome;status;tomador;cnpj;data_emissao;confianca;motivo"];
  for (const r of resultados) {
    csvLinhas.push([
      csvEscape(r.arquivoOriginal),
      csvEscape(r.novoNome),
      r.status,
      csvEscape(r.tomadorNome ?? ""),
      csvEscape(r.cnpjTomador ?? ""),
      r.dataEmissao ?? "",
      r.confianca.toFixed(2),
      csvEscape(r.motivo ?? ""),
    ].join(";"));
  }
  zip.file("relatorio.csv", "﻿" + csvLinhas.join("\r\n"));

  const zipBuf: Buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });

  await audit({
    session,
    action: "nf.renomear-lote",
    resource: "nota_fiscal",
    resourceId: "lote",
    after: {
      total: resultados.length,
      ok: resultados.filter((r) => r.status === "ok").length,
      parcial: resultados.filter((r) => r.status === "parcial").length,
      erro: resultados.filter((r) => r.status === "erro").length,
    },
    request: req,
  });

  // Filename do download — timestamp em SP só pra organização do usuário
  const ts = new Date().toISOString().slice(0, 16).replace(/[:T-]/g, "");
  return new NextResponse(zipBuf as any, {
    status: 200,
    headers: {
      ...rl.headers,
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="notas-renomeadas-${ts}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
