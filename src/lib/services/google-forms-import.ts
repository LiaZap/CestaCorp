/**
 * Importa respostas antigas dos Google Forms (.xlsx exportados do Google)
 * para a coleção `FormResponseModel` no MongoDB, preservando o timestamp original.
 *
 * O mapeamento é feito pelo cabeçalho da planilha → key do FormDefinition.
 * Se o slug não existir ainda, cria uma definition mínima com os campos encontrados.
 */

import ExcelJS from "exceljs";
import { connectMongo } from "@/lib/db/mongo";
import { FormDefinitionModel } from "@/models/FormDefinition";
import { FormResponseModel } from "@/models/FormResponse";

const TIMESTAMP_COL = "Carimbo de data/hora";

export interface ImportResult {
  slug: string;
  totalLinhas: number;
  importadas: number;
  duplicadas: number;
  criouDefinition: boolean;
}

/**
 * Normaliza um label de coluna em uma key estável (sem acentos/espaços).
 */
function toKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

function inferType(label: string): string {
  const l = label.toLowerCase();
  if (l.includes("email") || l.includes("e-mail")) return "email";
  if (l.includes("telefone") || l.includes("celular")) return "phone";
  if (l.includes("cpf") && !l.includes("cnpj")) return "cpf";
  if (l.includes("cnpj")) return "cnpj";
  if (l.includes("data") || l.includes("nascimento")) return "date";
  if (l.includes("valor") || l.includes("salario") || l.includes("capital") || l.includes("r$")) return "money";
  if (l.includes("anexe") || l.includes("foto") || l.includes("arquivo") || l.includes("c\u00f3pia")) return "file";
  if (l.length > 80) return "textarea";
  return "text";
}

export async function importarGoogleFormXlsx(
  buffer: Buffer,
  slug: string,
  opts?: { title?: string; category?: string; dryRun?: boolean }
): Promise<ImportResult> {
  await connectMongo();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error("Planilha sem abas");

  // linha 1 = cabeçalhos
  const headers: string[] = [];
  const header = sheet.getRow(1);
  header.eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col] = String(cell.value ?? "").trim();
  });

  // monta ou upserta a definition
  const fields = headers
    .filter((h) => h && h !== TIMESTAMP_COL)
    .map((label) => ({
      key: toKey(label),
      label,
      type: inferType(label),
      required: false,
    }));

  let criouDefinition = false;
  let definition = await FormDefinitionModel.findOne({ slug });
  if (!definition) {
    definition = await FormDefinitionModel.create({
      slug,
      title: opts?.title ?? slug,
      category: opts?.category ?? "outros",
      fields,
      active: true,
    });
    criouDefinition = true;
  }

  const keyByCol: Record<number, string> = {};
  headers.forEach((h, col) => {
    if (h && h !== TIMESTAMP_COL) keyByCol[col] = toKey(h);
  });

  let importadas = 0;
  let duplicadas = 0;
  const totalLinhas = sheet.rowCount - 1;

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const answers: Record<string, any> = {};
    let ts: Date | null = null;
    let autorEmail = "";
    let autorNome = "";
    let autorTel = "";

    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const header = headers[col];
      if (!header) return;
      const val = cell.value;

      if (header === TIMESTAMP_COL) {
        ts = val instanceof Date ? val : typeof val === "string" ? new Date(val) : null;
        return;
      }
      const k = keyByCol[col];
      if (!k) return;
      const display = typeof val === "object" && val !== null && "text" in val ? (val as any).text : val;
      answers[k] = display;
      const lower = header.toLowerCase();
      if (lower.includes("email") || lower.includes("e-mail")) autorEmail = String(display ?? "");
      if (lower.includes("nome") && !autorNome) autorNome = String(display ?? "");
      if (lower.includes("telefone") || lower.includes("celular")) autorTel = String(display ?? "");
    });

    if (Object.keys(answers).length === 0) continue;

    // dedupe por googleTimestamp + slug
    if (ts) {
      const existente = await FormResponseModel.findOne({
        formSlug: slug,
        googleTimestamp: ts,
      }).lean();
      if (existente) { duplicadas++; continue; }
    }

    if (!opts?.dryRun) {
      await FormResponseModel.create({
        formSlug: slug,
        formId: definition._id,
        autor: {
          nome: autorNome || "(importado do Google Forms)",
          email: autorEmail || "importado@cestacorp.com.br",
          telefone: autorTel,
        },
        answers,
        status: "RECEBIDO",
        origem: "import-google",
        googleTimestamp: ts,
      });
    }
    importadas++;
  }

  return { slug, totalLinhas, importadas, duplicadas, criouDefinition };
}
