/**
 * Lista unificada de documentos do cliente pra exibir no portal (#95).
 *
 * Patrick (reunião 05/06 17:25): "centralizar de repente os documentos do
 * cliente aqui... pode colocar em vez de contrato no geral 'Documentos'".
 *
 * Fontes:
 *  - Contrato         → contratos gerados pela equipe
 *  - NotaFiscal       → NFs emitidas/recebidas vinculadas
 *  - FileMetadata     → uploads (formulários, anexos, comprovantes)
 *
 * Saída padronizada pra renderização simples:
 *   {id, tipo, titulo, subtitulo, dataReferencia, downloadUrl, sizeBytes?}
 */

import { prisma } from "@/lib/db/prisma";

export type TipoDocumento = "contrato" | "nota-fiscal" | "upload";

export interface DocumentoPortal {
  id: string;                    // composto: "<tipo>:<idOriginal>"
  tipo: TipoDocumento;
  titulo: string;
  subtitulo: string;
  dataReferencia: Date;
  downloadUrl: string;
  /** Tamanho em bytes quando conhecido (uploads) */
  sizeBytes?: number;
  /** Identificador legível pra ZIP (sem caracteres ilegais filesystem) */
  nomeArquivo: string;
}

export interface FiltroDocumentos {
  tipo?: TipoDocumento | "todos";
  busca?: string;
  desde?: Date;
  ate?: Date;
}

function limparNome(s: string, max = 80): string {
  return s
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function fmtData(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("");
}

export async function listarDocumentosDoCliente(
  clienteId: string,
  filtro: FiltroDocumentos = {},
): Promise<DocumentoPortal[]> {
  const docs: DocumentoPortal[] = [];

  const incluir = (t: TipoDocumento) => !filtro.tipo || filtro.tipo === "todos" || filtro.tipo === t;
  const dataOk = (d: Date) => {
    if (filtro.desde && d < filtro.desde) return false;
    if (filtro.ate && d > filtro.ate) return false;
    return true;
  };

  // ─── Contratos ────────────────────────────────────────────────
  if (incluir("contrato")) {
    const contratos = await prisma.contrato.findMany({
      where: { clienteId, deletedAt: null },
      select: {
        id: true, numero: true, tipo: true, status: true,
        valorHonorarios: true, indiceReajuste: true,
        docxPath: true, pdfPath: true, createdAt: true,
        dataAssinatura: true,
      },
      orderBy: { createdAt: "desc" },
    });
    for (const c of contratos) {
      const dataRef = c.dataAssinatura ?? c.createdAt;
      if (!dataOk(dataRef)) continue;
      const titulo = c.numero ? `Contrato ${c.numero}` : `Contrato — ${c.tipo}`;
      docs.push({
        id: `contrato:${c.id}`,
        tipo: "contrato",
        titulo,
        subtitulo: `${c.tipo} · ${c.status}${c.indiceReajuste ? ` · ${c.indiceReajuste}` : ""}`,
        dataReferencia: dataRef,
        downloadUrl: `/api/portal/contratos/${c.id}/download`,
        nomeArquivo: `${limparNome(titulo)} ${fmtData(dataRef)}.pdf`,
      });
    }
  }

  // ─── Notas fiscais ────────────────────────────────────────────
  if (incluir("nota-fiscal")) {
    const notas = await prisma.notaFiscal.findMany({
      where: { clienteId },
      select: {
        id: true, numero: true, serie: true, tipo: true,
        dataEmissao: true, valorTotal: true,
        emitenteNome: true, xmlPath: true,
      },
      orderBy: { dataEmissao: "desc" },
      take: 200,
    });
    for (const n of notas) {
      if (!dataOk(n.dataEmissao)) continue;
      const titulo = `${n.tipo === "ENTRADA" ? "NF Entrada" : "NF Saída"} #${n.numero}`;
      docs.push({
        id: `nota-fiscal:${n.id}`,
        tipo: "nota-fiscal",
        titulo,
        subtitulo: `Emitente: ${n.emitenteNome}${n.serie ? ` · série ${n.serie}` : ""} · R$ ${Number(n.valorTotal).toFixed(2)}`,
        dataReferencia: n.dataEmissao,
        downloadUrl: `/api/portal/notas-fiscais/${n.id}/xml`,
        nomeArquivo: `${limparNome(`${titulo} ${n.emitenteNome}`)} ${fmtData(n.dataEmissao)}.xml`,
      });
    }
  }

  // ─── Uploads / Anexos (FileMetadata ownerId=clienteId) ──────
  if (incluir("upload")) {
    const arquivos = await prisma.fileMetadata.findMany({
      where: {
        OR: [
          { ownerType: "cliente", ownerId: clienteId },
          { scope: "form_response", ownerId: clienteId },
        ],
      },
      orderBy: { uploadedAt: "desc" },
      take: 300,
    });
    for (const f of arquivos) {
      if (!dataOk(f.uploadedAt)) continue;
      const titulo = f.nomeOriginal ?? `Documento ${f.hash.slice(0, 8)}${f.ext}`;
      docs.push({
        id: `upload:${f.hash}`,
        tipo: "upload",
        titulo,
        subtitulo: `${f.scope}${f.mime ? ` · ${f.mime}` : ""}`,
        dataReferencia: f.uploadedAt,
        downloadUrl: `/api/files/${f.hash}`,
        sizeBytes: f.tamanho,
        nomeArquivo: limparNome(titulo),
      });
    }
  }

  // ─── Filtro de busca textual (in-memory — volume baixo) ─────
  let resultado = docs;
  if (filtro.busca && filtro.busca.length >= 2) {
    const q = filtro.busca.toLowerCase();
    resultado = docs.filter(
      (d) => d.titulo.toLowerCase().includes(q) || d.subtitulo.toLowerCase().includes(q),
    );
  }

  return resultado.sort((a, b) => b.dataReferencia.getTime() - a.dataReferencia.getTime());
}
