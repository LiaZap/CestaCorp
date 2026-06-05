/**
 * Renomeador de PDFs de nota fiscal.
 *
 * Patrick (13/06 WhatsApp): "pessoal coloca um monte de PDF de NF e ele renomeia
 * com base no tomador e data: NOME COMPLETO DO TOMADOR DDMMAAAA.pdf".
 *
 * Pipeline:
 *   1. Recebe PDF (Buffer)
 *   2. OCR via Claude (já temos ocrDocumento) — extrai cnpjTomador + dataEmissao
 *   3. Resolve o NOME do tomador a partir do CNPJ — preferindo nosso cadastro
 *      Cliente (cpfCnpj match) e caindo em razaoSocial do próprio PDF se não achar
 *   4. Formata: "{NOME COMPLETO} {DDMMAAAA}.pdf" (sem acentos especiais
 *      que quebram filesystem Windows; mantém espaços + remove < > : " / \ | ? *)
 */

import { ocrDocumento } from "./ocr";
import { prisma } from "@/lib/db/prisma";
import { soDigitos } from "@/lib/security/documento";

export interface RenomearResultado {
  arquivoOriginal: string;
  novoNome: string;
  tomadorNome?: string;
  cnpjTomador?: string;
  dataEmissao?: string;
  confianca: number;
  /** "ok" se conseguiu extrair tudo, "parcial" se faltou algo, "erro" se OCR falhou. */
  status: "ok" | "parcial" | "erro";
  motivo?: string;
}

/** Remove caracteres ilegais em nome de arquivo Windows + normaliza espaços. */
export function limparNomeArquivo(s: string): string {
  return s
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "") // proibidos
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** Converte "YYYY-MM-DD" → "DDMMAAAA". Inválido → "" (nunca lança). */
export function formatarDataDDMMAAAA(iso?: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [aaaa, mm, dd] = iso.split("-");
  return `${dd}${mm}${aaaa}`;
}

/**
 * Renomeia 1 PDF.
 * @param pdfBuffer conteúdo do PDF (não decodifica filename — passa pra ocrDocumento)
 * @param arquivoOriginal nome original do arquivo (pra retorno + fallback)
 */
export async function renomearPdfNotaFiscal(
  pdfBuffer: Buffer,
  arquivoOriginal: string
): Promise<RenomearResultado> {
  let ocr;
  try {
    ocr = await ocrDocumento({ buffer: pdfBuffer, mime: "application/pdf" });
  } catch (err: any) {
    return {
      arquivoOriginal,
      novoNome: arquivoOriginal,
      confianca: 0,
      status: "erro",
      motivo: `OCR falhou: ${String(err?.message ?? err).slice(0, 200)}`,
    };
  }

  // OCR mock (nenhuma OPENAI_API_KEY nem ANTHROPIC_API_KEY configurada).
  // Não tenta renomear pra não criar arquivo com dado fake.
  if (ocr.provider === "mock") {
    return {
      arquivoOriginal,
      novoNome: arquivoOriginal,
      confianca: 0,
      status: "erro",
      motivo: "Configure OPENAI_API_KEY (ou ANTHROPIC_API_KEY) no EasyPanel — OCR está em modo mock.",
    };
  }

  const cnpjDigits = ocr.cnpjTomador ? soDigitos(ocr.cnpjTomador) : undefined;
  const data = formatarDataDDMMAAAA(ocr.dataEmissao);

  // Resolve nome do tomador
  let tomadorNome: string | undefined;
  if (cnpjDigits) {
    // Tenta match no nosso cadastro
    const cliente = await prisma.cliente.findUnique({
      where: { cpfCnpj: formatarCnpjMatch(cnpjDigits) },
      select: { razaoSocial: true, nomeFantasia: true },
    });
    if (cliente) {
      tomadorNome = cliente.razaoSocial;
    }
  }
  // Fallback: usa descricao do OCR se for um nome plausível (não é o ideal,
  // mas evita "renomear" pra string vazia se cliente não está cadastrado)
  if (!tomadorNome && ocr.descricao) {
    // Heurística: pega o que parece nome (palavras com 3+ letras)
    const candidatos = ocr.descricao
      .split(/\s+/)
      .filter((p) => /^[A-Za-zÀ-ÿ]{3,}$/.test(p))
      .slice(0, 4)
      .join(" ");
    if (candidatos.length >= 6) tomadorNome = candidatos;
  }

  const temTomador = Boolean(tomadorNome && tomadorNome.length >= 3);
  const temData = Boolean(data);

  if (!temTomador && !temData) {
    return {
      arquivoOriginal,
      novoNome: arquivoOriginal,
      confianca: ocr.confianca,
      status: "erro",
      motivo: "Não consegui identificar tomador nem data — OCR baixa confiança",
    };
  }

  // Monta novo nome
  const partes: string[] = [];
  if (temTomador) partes.push(limparNomeArquivo(tomadorNome!));
  if (temData) partes.push(data);
  const baseNome = partes.join(" ") || arquivoOriginal.replace(/\.pdf$/i, "");
  const novoNome = `${baseNome}.pdf`;

  return {
    arquivoOriginal,
    novoNome,
    tomadorNome,
    cnpjTomador: cnpjDigits,
    dataEmissao: ocr.dataEmissao,
    confianca: ocr.confianca,
    status: temTomador && temData ? "ok" : "parcial",
    motivo: !temTomador
      ? "Sem tomador — usando só a data"
      : !temData
        ? "Sem data — usando só o tomador"
        : undefined,
  };
}

/** Formata CNPJ "12345678000195" → "12.345.678/0001-95" pra match com nosso cadastro. */
function formatarCnpjMatch(digits: string): string {
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return digits;
}
