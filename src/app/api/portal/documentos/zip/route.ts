import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import JSZip from "jszip";
import { auth } from "@/lib/auth";
import { listarDocumentosDoCliente, type TipoDocumento } from "@/lib/services/portal-documentos";
import { prisma } from "@/lib/db/prisma";

/**
 * Empacota TODOS os documentos visíveis do cliente em um ZIP (#95).
 * Honra os mesmos filtros que /portal/documentos (tipo, q, ano).
 *
 * Volume típico: 10–80 arquivos × média 200 KB = ~10–20 MB → streaming não
 * é crítico; JSZip em memória é suficiente. Aborta com 413 se passar de 100 MB.
 */
const LIMITE_BYTES = 100 * 1024 * 1024;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const u = session.user as any;
  if (u.tipo !== "cliente") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const tipo = (url.searchParams.get("tipo") ?? "todos") as TipoDocumento | "todos";
  const q = url.searchParams.get("q") ?? undefined;
  const anoStr = url.searchParams.get("ano");
  const ano = anoStr ? Number(anoStr) : undefined;

  const desde = ano ? new Date(ano, 0, 1) : undefined;
  const ate = ano ? new Date(ano, 11, 31, 23, 59, 59) : undefined;

  const documentos = await listarDocumentosDoCliente(u.clienteId, {
    tipo: tipo === "todos" ? "todos" : tipo,
    busca: q ?? undefined,
    desde, ate,
  });

  if (documentos.length === 0) {
    return NextResponse.json({ error: "Nenhum documento nesse filtro" }, { status: 404 });
  }

  // Resolve paths físicos por id composto
  const zip = new JSZip();
  let totalBytes = 0;
  const errosLog: string[] = [];
  const usedNames = new Set<string>();

  function nomeUnico(nome: string): string {
    if (!usedNames.has(nome)) { usedNames.add(nome); return nome; }
    const dot = nome.lastIndexOf(".");
    const base = dot > 0 ? nome.slice(0, dot) : nome;
    const ext = dot > 0 ? nome.slice(dot) : "";
    let i = 2;
    while (usedNames.has(`${base} (${i})${ext}`)) i++;
    const novo = `${base} (${i})${ext}`;
    usedNames.add(novo);
    return novo;
  }

  for (const doc of documentos) {
    const [tipoDoc, idOriginal] = doc.id.split(":");
    let path: string | null = null;
    try {
      if (tipoDoc === "contrato") {
        const c = await prisma.contrato.findUnique({ where: { id: idOriginal }, select: { pdfPath: true, docxPath: true } });
        path = c?.pdfPath ?? c?.docxPath ?? null;
      } else if (tipoDoc === "nota-fiscal") {
        const n = await prisma.notaFiscal.findUnique({ where: { id: idOriginal }, select: { xmlPath: true } });
        path = n?.xmlPath ?? null;
      } else if (tipoDoc === "upload") {
        // FileMetadata.hash = idOriginal — arquivo físico em uploads/<hash><ext>
        const f = await prisma.fileMetadata.findUnique({ where: { hash: idOriginal }, select: { ext: true, hash: true } });
        if (f) path = `uploads/${f.hash}${f.ext}`;
      }

      if (!path || !fs.existsSync(path)) {
        errosLog.push(`${doc.titulo}: arquivo físico ausente`);
        continue;
      }
      const stat = fs.statSync(path);
      totalBytes += stat.size;
      if (totalBytes > LIMITE_BYTES) {
        return NextResponse.json(
          { error: `Limite de 100 MB excedido. Use filtros pra reduzir o lote (atual: ${(totalBytes / 1024 / 1024).toFixed(1)} MB).` },
          { status: 413 },
        );
      }
      const buffer = fs.readFileSync(path);
      const nome = nomeUnico(doc.nomeArquivo);
      zip.file(nome, buffer);
    } catch (err: any) {
      errosLog.push(`${doc.titulo}: ${String(err?.message ?? err).slice(0, 100)}`);
    }
  }

  // Adiciona log de erros se houver
  if (errosLog.length > 0) {
    zip.file("_LEIA_ME-arquivos-ausentes.txt", errosLog.join("\n"));
  }

  const blob = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");

  return new NextResponse(new Uint8Array(blob), {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="documentos-cestacorp-${stamp}.zip"`,
      "content-length": String(blob.length),
      "cache-control": "no-store",
    },
  });
}
