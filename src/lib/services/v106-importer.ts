/**
 * Importador da V106 — processa as 4 abas mais importantes:
 *   1. CLIENTES        → Cliente (cadastro principal)
 *   2. TAGS HUBLX      → Tag + ClienteTag (mapeamento Marlon: regime, folha, etc.)
 *   3. ANIVERSARIANTES → Socio.dataNascimento (aniversário do sócio)
 *   4. EMAILS          → ContatoEmail
 *
 * Cada aba tem sua função idempotente (pode rodar várias vezes sem duplicar).
 *
 * Saída padronizada por aba:
 *   { aba: "CLIENTES", novos, atualizados, ignorados, detalhes }
 */

import ExcelJS from "exceljs";
import { prisma } from "@/lib/db/prisma";
import { isDocumentoValido } from "@/lib/security/documento";
import { logger } from "@/lib/logger";
import { importarV106Extras } from "./v106-importer-extra";

export interface AbaResult {
  aba: string;
  ok: boolean;
  novos: number;
  atualizados: number;
  ignorados: number;
  detalhes?: { linha: number; razao?: string; motivo: string }[];
  erro?: string;
}

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function txt(v: any): string {
  if (v == null) return "";
  if (typeof v === "object" && "text" in v) return String(v.text).trim();
  if (typeof v === "object" && "result" in v) return String(v.result ?? "").trim();
  return String(v).trim();
}

function soDigitos(s: string): string {
  return (s ?? "").replace(/\D/g, "");
}

function formatarCpfCnpj(d: string): string {
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return d;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function dateOrNull(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "string") {
    // formato BR "05/08/1985"
    const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      const [_, d, mes, a] = m;
      let ano = Number(a);
      if (ano < 100) ano += ano < 50 ? 2000 : 1900;
      const dt = new Date(ano, Number(mes) - 1, Number(d));
      return isNaN(dt.getTime()) ? null : dt;
    }
    const dt = new Date(v);
    return isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

// =====================================================================
// ABA 1: CLIENTES
// =====================================================================
async function importarClientes(wb: ExcelJS.Workbook): Promise<AbaResult> {
  const sheet = wb.getWorksheet("CLIENTES");
  if (!sheet) return { aba: "CLIENTES", ok: false, novos: 0, atualizados: 0, ignorados: 0, erro: "aba não encontrada" };

  let novos = 0, atualizados = 0, ignorados = 0;
  const detalhes: AbaResult["detalhes"] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const razao = txt(row.getCell(2).value);
    const docRaw = txt(row.getCell(3).value);
    const doc = soDigitos(docRaw);
    if (!razao || !doc) {
      ignorados++;
      if (razao) detalhes.push({ linha: r, razao, motivo: "documento vazio" });
      continue;
    }
    if (!isDocumentoValido(doc)) {
      ignorados++;
      detalhes.push({ linha: r, razao, motivo: `documento inválido: ${docRaw}` });
      continue;
    }

    const codigo = Number(row.getCell(1).value) || null;
    const classRaw = txt(row.getCell(5).value).toLowerCase();
    const classMap: Record<string, "BRONZE" | "PRATA" | "OURO" | "TOP"> = {
      bronze: "BRONZE", prata: "PRATA", ouro: "OURO", top: "TOP",
    };
    const classificacao = classMap[classRaw] ?? null;

    const statusRaw = txt(row.getCell(19).value).toUpperCase();
    let status: "ATIVO" | "INATIVO" | "ENCERRADO" | "SUSPENSO" = "ATIVO";
    if (statusRaw.includes("ENCERR")) status = "ENCERRADO";
    else if (statusRaw.includes("INATIV") || statusRaw.includes("SUSPENS")) status = "SUSPENSO";
    else if (!statusRaw.includes("ATIV")) status = "INATIVO";

    const inicio = dateOrNull(row.getCell(20).value);
    const reajusteMes = MESES[txt(row.getCell(25).value).toLowerCase()] ?? null;
    const tipoPessoa = doc.length === 11 ? "FISICA" : "JURIDICA";
    const cpfCnpj = formatarCpfCnpj(doc);

    try {
      const data = {
        codigo,
        razaoSocial: razao,
        cpfCnpj,
        tipoPessoa: tipoPessoa as any,
        classificacao: classificacao as any,
        rentabilidade: txt(row.getCell(6).value) || null,
        risco: txt(row.getCell(7).value) || null,
        tributacao: txt(row.getCell(8).value) || null,
        faturamento: txt(row.getCell(10).value) || null,
        prefeitura: txt(row.getCell(11).value) || null,
        fluxoFiscal: txt(row.getCell(13).value) || null,
        respFiscal: txt(row.getCell(14).value) || null,
        folha: txt(row.getCell(15).value) || null,
        respFolha: txt(row.getCell(16).value) || null,
        contabil: txt(row.getCell(17).value) || null,
        respContabil: txt(row.getCell(18).value) || null,
        status: status as any,
        inicio,
        chaveInicio: txt(row.getCell(21).value) || null,
        meioCaptacao: txt(row.getCell(22).value) || null,
        indicacao: txt(row.getCell(23).value) || null,
        mesAniversarioReajuste: reajusteMes,
      };

      const existente = await prisma.cliente.findUnique({ where: { cpfCnpj } });
      if (existente) {
        await prisma.cliente.update({ where: { id: existente.id }, data });
        atualizados++;
      } else {
        await prisma.cliente.create({ data });
        novos++;
      }
    } catch (e: any) {
      ignorados++;
      detalhes.push({ linha: r, razao, motivo: String(e?.message ?? e).slice(0, 200) });
    }
  }

  return { aba: "CLIENTES", ok: true, novos, atualizados, ignorados, detalhes: detalhes.slice(0, 20) };
}

// =====================================================================
// ABA 2: TAGS HUBLX (planilha do Marlon)
// Layout: cada coluna a partir da 3 é uma TAG. Linha 1 = nome da tag, linha 2 = descrição/título.
// Linhas 3+: cada linha é um cliente (col 1 = código, col 2 = nome). Célula com "X" ou similar = tag aplicada.
// =====================================================================

/**
 * Categoriza tags pelo nome (regex match) — usado na importação da V-106.
 */
type TagCategoria = "GERAL" | "REGIME" | "FOLHA" | "SEGMENTO" | "MUNICIPIO" | "CLASSIFICACAO" | "HONORARIO" | "SERVICO" | "OPERACIONAL";

function categorizarTag(nome: string): { categoria: TagCategoria; cor: string } {
  const n = nome.toLowerCase();
  if (/simples nacional|presumido|lucro real|carn[êe] le[ãa]o|^mei$|^mei |regime geral|im(une|posto)/i.test(n)) {
    return { categoria: "REGIME", cor: "#1F4FC4" };
  }
  if (/folha|funcion[áa]rio|pr[óo]-?labore|gps|fgts|inss|esocial|domestic/i.test(n)) {
    return { categoria: "FOLHA", cor: "#84CC16" };
  }
  if (/honor[áa]rios? dia|venc.*dia/i.test(n)) {
    return { categoria: "HONORARIO", cor: "#F59E0B" };
  }
  if (/prefeitura|porto alegre|s[ãa]o paulo|guia iss/i.test(n)) {
    return { categoria: "MUNICIPIO", cor: "#0EA5E9" };
  }
  if (/gest[ãa]o de (agenda|cobran|contrat)|servi[çc]o/i.test(n)) {
    return { categoria: "SERVICO", cor: "#A855F7" };
  }
  if (/^bronze$|^prata$|^ouro$|^top$|^vip$/i.test(n)) {
    return { categoria: "CLASSIFICACAO", cor: "#EAB308" };
  }
  if (/d[ée]bito|parcelamento|emite suas notas|cart[ãa]o|arquivo|comunicado/i.test(n)) {
    return { categoria: "OPERACIONAL", cor: "#64748B" };
  }
  if (/tecnolog|advocac|ind[úu]stri|com[ée]rcio|sa[úu]de|servi[çc]os/i.test(n)) {
    return { categoria: "SEGMENTO", cor: "#EC4899" };
  }
  return { categoria: "GERAL", cor: "#84CC16" };
}

async function importarTagsHublx(wb: ExcelJS.Workbook): Promise<AbaResult> {
  const sheet = wb.getWorksheet("TAGS HUBLX");
  if (!sheet) return { aba: "TAGS HUBLX", ok: false, novos: 0, atualizados: 0, ignorados: 0, erro: "aba não encontrada" };

  // Lê headers (linha 1) — colunas 3 em diante são tags
  const tags: { col: number; nome: string; tagId?: string }[] = [];
  for (let c = 3; c <= sheet.columnCount; c++) {
    const nome = txt(sheet.getRow(1).getCell(c).value);
    if (nome && nome !== "TAGS / EMPRESAS") {
      tags.push({ col: c, nome: nome.replace(/\s+/g, " ").trim() });
    }
  }

  // Cria/upsert as Tags com categorização automática
  let novosTags = 0;
  for (const t of tags) {
    const slug = slugify(t.nome);
    if (!slug) continue;
    const { categoria, cor } = categorizarTag(t.nome);
    const tag = await prisma.tag.upsert({
      where: { slug },
      create: {
        slug,
        nome: t.nome,
        cor,
        categoria: categoria as any,
        origem: "v106-hublx",
      },
      update: { nome: t.nome, cor, categoria: categoria as any },
    });
    t.tagId = tag.id;
    if (tag.createdAt && tag.createdAt.getTime() > Date.now() - 60_000) novosTags++;
  }

  // Aplica tags aos clientes (a partir da linha 3)
  let aplicadas = 0, removidas = 0, ignorados = 0;
  const detalhes: AbaResult["detalhes"] = [];

  for (let r = 3; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const codigo = Number(row.getCell(1).value);
    if (!codigo) continue;

    const cliente = await prisma.cliente.findUnique({ where: { codigo } });
    if (!cliente) {
      ignorados++;
      if (detalhes!.length < 10) {
        detalhes!.push({ linha: r, motivo: `cliente código ${codigo} não encontrado` });
      }
      continue;
    }

    // Para cada tag, verifica se a célula está marcada
    for (const t of tags) {
      if (!t.tagId) continue;
      const valor = txt(row.getCell(t.col).value).toUpperCase();
      const aplicada = ["X", "✓", "SIM", "S", "TRUE", "1"].includes(valor) || valor.length > 1;

      const existente = await prisma.clienteTag.findUnique({
        where: { clienteId_tagId: { clienteId: cliente.id, tagId: t.tagId } },
      });

      if (aplicada && !existente) {
        await prisma.clienteTag.create({
          data: { clienteId: cliente.id, tagId: t.tagId },
        });
        aplicadas++;
      } else if (!aplicada && existente) {
        await prisma.clienteTag.delete({
          where: { clienteId_tagId: { clienteId: cliente.id, tagId: t.tagId } },
        });
        removidas++;
      }
    }
  }

  return {
    aba: "TAGS HUBLX",
    ok: true,
    novos: novosTags,         // tags criadas
    atualizados: aplicadas,   // associações criadas
    ignorados,
    detalhes: detalhes!.slice(0, 20),
  };
}

// =====================================================================
// ABA 3: ANIVERSARIANTES
// Layout: col 1=CÓD, col 2=CLIENTES, col 8/10/12=NOME do sócio, col 9/11/13=DATA
// =====================================================================
async function importarAniversariantes(wb: ExcelJS.Workbook): Promise<AbaResult> {
  const sheet = wb.getWorksheet("ANIVERSARIANTES");
  if (!sheet) return { aba: "ANIVERSARIANTES", ok: false, novos: 0, atualizados: 0, ignorados: 0, erro: "aba não encontrada" };

  let novos = 0, atualizados = 0, ignorados = 0;
  const detalhes: AbaResult["detalhes"] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const codigo = Number(row.getCell(1).value);
    if (!codigo) continue;

    const cliente = await prisma.cliente.findUnique({ where: { codigo } });
    if (!cliente) {
      ignorados++;
      continue;
    }

    // Pode ter até 3 sócios listados na mesma linha
    for (const par of [{ nomeCol: 8, dataCol: 9 }, { nomeCol: 10, dataCol: 11 }, { nomeCol: 12, dataCol: 13 }]) {
      const nome = txt(row.getCell(par.nomeCol).value);
      const data = dateOrNull(row.getCell(par.dataCol).value);
      if (!nome || !data) continue;

      // Busca sócio por nome dentro do cliente
      const existente = await prisma.socio.findFirst({
        where: { clienteId: cliente.id, nome: { equals: nome, mode: "insensitive" } },
      });

      if (existente) {
        await prisma.socio.update({
          where: { id: existente.id },
          data: { dataNascimento: data },
        });
        atualizados++;
      } else {
        // Cria sócio mínimo só com nome + data (CPF placeholder se necessário)
        await prisma.socio.create({
          data: {
            clienteId: cliente.id,
            nome,
            cpf: `00000000000-${cliente.id.slice(-4)}`, // placeholder
            dataNascimento: data,
          },
        }).catch(() => {});
        novos++;
      }
    }
  }

  return {
    aba: "ANIVERSARIANTES",
    ok: true,
    novos, atualizados, ignorados,
    detalhes: detalhes!.slice(0, 20),
  };
}

// =====================================================================
// ABA 4: EMAILS
// Layout: 1=Código, 2=Nome Fantasia, 3=Razão Social, 4=CNPJ, 7=contato da empresa, 8=email, 9=telefone
// =====================================================================
async function importarEmails(wb: ExcelJS.Workbook): Promise<AbaResult> {
  const sheet = wb.getWorksheet("EMAILS");
  if (!sheet) return { aba: "EMAILS", ok: false, novos: 0, atualizados: 0, ignorados: 0, erro: "aba não encontrada" };

  let novos = 0, atualizados = 0, ignorados = 0;

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const codigo = Number(row.getCell(1).value);
    if (!codigo) continue;

    const nomeFantasia = txt(row.getCell(2).value);
    const email = txt(row.getCell(8).value).toLowerCase();
    const telefone = txt(row.getCell(9).value);

    if (!email || !email.includes("@")) {
      ignorados++;
      continue;
    }

    const cliente = await prisma.cliente.findUnique({ where: { codigo } });
    if (!cliente) { ignorados++; continue; }

    // Atualiza nomeFantasia se ainda não tiver
    if (nomeFantasia && !cliente.nomeFantasia) {
      await prisma.cliente.update({
        where: { id: cliente.id },
        data: { nomeFantasia },
      });
    }

    // Cria/atualiza email
    const emailExistente = await prisma.contatoEmail.findFirst({
      where: { clienteId: cliente.id, email },
    });
    if (emailExistente) {
      atualizados++;
    } else {
      await prisma.contatoEmail.create({
        data: { clienteId: cliente.id, email, principal: true, tipo: "principal" },
      });
      novos++;
    }

    // Telefone
    if (telefone && telefone.length >= 8) {
      const telLimpo = soDigitos(telefone);
      const telExistente = await prisma.contatoTelefone.findFirst({
        where: { clienteId: cliente.id, numero: telLimpo },
      });
      if (!telExistente) {
        await prisma.contatoTelefone.create({
          data: { clienteId: cliente.id, numero: telLimpo, principal: true, whatsapp: true },
        });
      }
    }
  }

  return { aba: "EMAILS", ok: true, novos, atualizados, ignorados };
}

// =====================================================================
// ENTRY POINT
// =====================================================================
export async function importarV106Completo(buffer: Buffer): Promise<AbaResult[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  const resultados: AbaResult[] = [];

  // Ordem importa: CLIENTES primeiro (resto depende deles)
  logger.info("V-106: importando CLIENTES…");
  resultados.push(await importarClientes(wb));

  logger.info("V-106: importando EMAILS…");
  resultados.push(await importarEmails(wb));

  logger.info("V-106: importando TAGS HUBLX…");
  resultados.push(await importarTagsHublx(wb));

  logger.info("V-106: importando ANIVERSARIANTES…");
  resultados.push(await importarAniversariantes(wb));

  // Abas extras (mensagens, indicações, agendas, endereços, etc.)
  const extras = await importarV106Extras(wb);
  resultados.push(...extras);

  return resultados;
}
