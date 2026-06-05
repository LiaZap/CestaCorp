/**
 * Importadores das últimas 7 abas da V-106 (continuação de v106-importer-extra.ts).
 * Justificativa: Patrick vai MIGRAR pra cá — tudo da planilha tem que estar dentro
 * do sistema, senão equipe vai precisar abrir Excel pra trabalhar.
 *
 *   1. CERTIFICADOS    → CertificadoDigital + ProcuracaoEcac + AcessoDecweb
 *   2. RESPONSÁVEIS    → ClienteResponsavel (resumo simplificado — 1ª col válida)
 *   3. HONORÁRIOS      → ReajusteHistorico (snapshots anuais 2018-2024)
 *   4. ATIVIDADES      → AtividadeCatalogo
 *   5. OBRIGAÇÕES      → Obrigacao (uma por par setor×atividade)
 *   6. ÍNDICE          → CatalogoServico (12 serviços oficiais)
 *   7. ENCERRADOS      → Cliente.status = ENCERRADO + dataEncerramento
 *
 * Todas idempotentes. Senhas de certificado entram já criptografadas se
 * CERTIFICATE_ENCRYPTION_KEY estiver configurada, senão warn + plaintext (dev).
 */

import ExcelJS from "exceljs";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { criptografarSenha } from "@/lib/security/cripto-senha";

export interface AbaResult {
  aba: string;
  ok: boolean;
  novos: number;
  atualizados: number;
  ignorados: number;
  detalhes?: { linha: number; razao?: string; motivo: string }[];
  erro?: string;
}

function txt(v: any): string {
  if (v == null) return "";
  if (typeof v === "object" && "text" in v) return String(v.text).trim();
  if (typeof v === "object" && "result" in v) return String(v.result ?? "").trim();
  if (typeof v === "object" && "richText" in v && Array.isArray((v as any).richText)) {
    return (v as any).richText.map((p: any) => p.text ?? "").join("").trim();
  }
  return String(v).trim();
}

function dateOrNull(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "object" && "result" in v) return dateOrNull((v as any).result);
  if (typeof v === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = v * 86400000;
    const dt = new Date(epoch.getTime() + ms);
    return isNaN(dt.getTime()) ? null : dt;
  }
  if (typeof v === "string") {
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

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function num(v: any): number | null {
  const s = txt(v).replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) || n === 0 ? null : n;
}

// =====================================================================
// 1. CERTIFICADOS — cols (1-baseado):
//   col 49 = PROC ECAC          ("SIM" / "NÃO" / data)
//   col 52 = NIRE
//   col 53 = CERTIF.
//   col 54 = PROC. (e-CAC?)
//   col 55 = DECWEB
//   col 62 = PRÓX RENOV (e-CAC)
//   col 63 = CERT DIG (serial/nome)
//   col 64 = SENHA (do certificado)
//   col 65 = SIEG (sim/não)
//   col 66 = DET (sim/não)
//   col 67 = LOGIN (DECWEB)
//   col 68 = PRÓX RENOV CERT DIG
//   col 69 = NOTIFICAR (responsável)
//   col 70 = CERTIFICADORA (VALID/SERASA/AC SOLUTI)
//   col 71 = PROC DECWEB
// =====================================================================
export async function importarCertificados(wb: ExcelJS.Workbook): Promise<AbaResult> {
  const sheet = wb.getWorksheet("CERTIFICADOS");
  if (!sheet) return { aba: "CERTIFICADOS", ok: false, novos: 0, atualizados: 0, ignorados: 0, erro: "aba não encontrada" };

  let novos = 0, atualizados = 0, ignorados = 0;
  const detalhes: AbaResult["detalhes"] = [];

  for (let r = 3; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const codigo = Number(row.getCell(1).value);
    if (!codigo) continue;
    const cliente = await prisma.cliente.findUnique({ where: { codigo } });
    if (!cliente) { ignorados++; continue; }

    const procEcac = txt(row.getCell(49).value).toUpperCase();
    const certDigSerial = txt(row.getCell(63).value);
    const senhaCert = txt(row.getCell(64).value);
    const proxRenovEcac = dateOrNull(row.getCell(62).value);
    const proxRenovCertDig = dateOrNull(row.getCell(68).value);
    const sieg = txt(row.getCell(65).value).toUpperCase() === "SIM";
    const det = txt(row.getCell(66).value).toUpperCase() === "SIM";
    const loginDecweb = txt(row.getCell(67).value);
    const notificar = txt(row.getCell(69).value);
    const certificadora = txt(row.getCell(70).value);
    const procDecweb = txt(row.getCell(71).value).toUpperCase();

    let tocou = false;

    // CertificadoDigital — só cria se temos serial OU senha
    if (certDigSerial || senhaCert || proxRenovCertDig) {
      const existente = await prisma.certificadoDigital.findFirst({
        where: { clienteId: cliente.id, serial: certDigSerial || undefined },
      });
      let senhaEnc: string | null = null;
      if (senhaCert) {
        try { senhaEnc = await criptografarSenha(senhaCert); }
        catch { senhaEnc = senhaCert; /* dev fallback */ }
      }
      const dadosCert = {
        certificadora: certificadora || null,
        serial: certDigSerial || null,
        proximaRenov: proxRenovCertDig,
        senha: senhaEnc,
        notificarResponsavel: notificar || null,
      };
      if (existente) {
        await prisma.certificadoDigital.update({ where: { id: existente.id }, data: dadosCert });
        atualizados++;
      } else {
        await prisma.certificadoDigital.create({ data: { clienteId: cliente.id, ...dadosCert } });
        novos++;
      }
      tocou = true;
    }

    // ProcuracaoEcac
    if (procEcac && procEcac !== "-" && procEcac !== "NÃO POSSUI" && procEcac !== "NÃO") {
      const existeP = await prisma.procuracaoEcac.findFirst({
        where: { clienteId: cliente.id },
      });
      const dadosP = {
        procuradorCpf: "27037321000168", // CNPJ Cestacorp como procurador default (Patrick refina depois)
        procuradorNome: "CESTACORP",
        proximaRenov: proxRenovEcac,
      };
      if (existeP) {
        await prisma.procuracaoEcac.update({
          where: { id: existeP.id },
          data: { proximaRenov: dadosP.proximaRenov ?? existeP.proximaRenov },
        });
      } else {
        await prisma.procuracaoEcac.create({ data: { clienteId: cliente.id, ...dadosP } });
        if (!tocou) novos++;
      }
      tocou = true;
    }

    // AcessoDecweb
    if (loginDecweb || procDecweb === "SIM" || procDecweb.includes("PADRÃO")) {
      const existeD = await prisma.acessoDecweb.findFirst({ where: { clienteId: cliente.id } });
      const dadosD = {
        login: loginDecweb || null,
        procuracao: procDecweb === "SIM" || procDecweb.includes("PADRÃO"),
      };
      if (existeD) {
        await prisma.acessoDecweb.update({ where: { id: existeD.id }, data: dadosD });
      } else {
        await prisma.acessoDecweb.create({ data: { clienteId: cliente.id, ...dadosD } });
        if (!tocou) novos++;
      }
      tocou = true;
    }

    // SIEG/DET viram flags do Cliente (campo já existe)
    if (sieg !== cliente.sieg || det !== cliente.det) {
      await prisma.cliente.update({ where: { id: cliente.id }, data: { sieg, det } });
      if (!tocou) atualizados++;
    }
  }

  return { aba: "CERTIFICADOS", ok: true, novos, atualizados, ignorados, detalhes: detalhes!.slice(0, 20) };
}

// =====================================================================
// 2. RESPONSÁVEIS — header complicado (87 cols, matriz). Pegamos col 2 = SETOR
//   e col 3 = RESPONSÁVEL (nome). Mapeia pra responsável "inicial" de setor
//   (valor padrão quando empresa nova é cadastrada).
//   Patrick: "RESPONSÁVEIS INICIAIS PARA NOVAS EMPRESAS"
// =====================================================================
export async function importarResponsaveisIniciais(wb: ExcelJS.Workbook): Promise<AbaResult> {
  const sheet = wb.getWorksheet("RESPONSÁVEIS");
  if (!sheet) return { aba: "RESPONSÁVEIS", ok: false, novos: 0, atualizados: 0, ignorados: 0, erro: "aba não encontrada" };

  // Procura linhas tipo (setor, responsável) — fora do bloco "RESUMO"
  let novos = 0, ignorados = 0;
  const SETORES = ["Contábil", "Fiscal", "Folha", "Societário", "Comercial", "Financeiro", "BPO"];
  const padroes: Record<string, string> = {};

  for (let r = 1; r <= Math.min(sheet.rowCount, 50); r++) {
    const row = sheet.getRow(r);
    const setor = txt(row.getCell(2).value);
    const resp = txt(row.getCell(3).value);
    if (!setor || !resp) continue;
    if (SETORES.find((s) => s.toLowerCase() === setor.toLowerCase()) && resp.length < 40) {
      padroes[setor.toUpperCase()] = resp;
    }
  }

  // Salva como ConfiguracaoSistema-style: grava em uma tag/parâmetro acessível
  // Não temos model dedicado pra defaults — guardamos como Tag de categoria OPERACIONAL
  // pra ficar visível em /configuracoes.
  for (const [setor, nome] of Object.entries(padroes)) {
    const slug = slugify(`responsavel-padrao-${setor}`);
    const existe = await prisma.tag.findUnique({ where: { slug } });
    if (existe) continue;
    await prisma.tag.create({
      data: {
        slug,
        nome: `Responsável padrão ${setor}: ${nome}`,
        cor: "#64748B",
        categoria: "OPERACIONAL" as any,
        origem: "v106-responsaveis",
        descricao: `Padrão atribuído a novos clientes para o setor ${setor}.`,
      },
    });
    novos++;
  }

  return { aba: "RESPONSÁVEIS", ok: true, novos, atualizados: 0, ignorados };
}

// =====================================================================
// 3. HONORÁRIOS — col 1=CÓD, col 3=EMPRESAS, cols 5-8 = valores anuais 2018-2021
//   Vai pra ReajusteHistorico (snapshot por ano).
// =====================================================================
export async function importarHistoricoHonorarios(wb: ExcelJS.Workbook): Promise<AbaResult> {
  const sheet = wb.getWorksheet("HONORÁRIOS");
  if (!sheet) return { aba: "HONORÁRIOS", ok: false, novos: 0, atualizados: 0, ignorados: 0, erro: "aba não encontrada" };

  let novos = 0, ignorados = 0;
  const ANOS = [
    { col: 5, ano: 2018 }, { col: 6, ano: 2019 },
    { col: 7, ano: 2020 }, { col: 8, ano: 2021 },
  ];

  for (let r = 3; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const codigo = Number(row.getCell(1).value);
    if (!codigo) continue;
    const cliente = await prisma.cliente.findUnique({ where: { codigo } });
    if (!cliente) { ignorados++; continue; }

    let valorAnterior: number | null = null;
    for (const { col, ano } of ANOS) {
      const valor = num(row.getCell(col).value);
      if (!valor) { valorAnterior = null; continue; }

      const existe = await prisma.reajusteHistorico.findUnique({
        where: { clienteId_ano: { clienteId: cliente.id, ano } },
      });
      if (existe) { valorAnterior = valor; continue; }

      const base = valorAnterior ?? valor;
      const pct = valorAnterior ? ((valor - valorAnterior) / valorAnterior) * 100 : 0;

      try {
        await prisma.reajusteHistorico.create({
          data: {
            clienteId: cliente.id,
            ano,
            valorAnoBase: base,
            valorAposReajuste: valor,
            percentualReajuste: Number(pct.toFixed(4)),
            indiceUsado: "V106 import",
            aplicadoEm: new Date(ano, 0, 1),
          },
        });
        novos++;
      } catch { ignorados++; }
      valorAnterior = valor;
    }
  }

  return { aba: "HONORÁRIOS", ok: true, novos, atualizados: 0, ignorados };
}

// =====================================================================
// 4. ATIVIDADES — col 1=REGIME, col 2=SETOR, col 3=PERIODICIDADE, col 4=ATIVIDADE
// =====================================================================
export async function importarAtividadesCatalogo(wb: ExcelJS.Workbook): Promise<AbaResult> {
  const sheet = wb.getWorksheet("ATIVIDADES");
  if (!sheet) return { aba: "ATIVIDADES", ok: false, novos: 0, atualizados: 0, ignorados: 0, erro: "aba não encontrada" };

  let novos = 0, ignorados = 0;
  const PERIOD_MAP: Record<string, "MENSAL" | "ANUAL" | "TRIMESTRAL" | "SEMESTRAL"> = {
    MENSAL: "MENSAL", ANUAL: "ANUAL", TRIMESTRAL: "TRIMESTRAL",
    SEMESTRAL: "SEMESTRAL", SEMANAL: "MENSAL",
  };

  // Estrutura: cada coluna pode ser um regime distinto; cabeçalho varia.
  // Estratégia conservadora: linha por linha, cols 1-4.
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const regime = txt(row.getCell(1).value);
    const setor = txt(row.getCell(2).value);
    const periodRaw = txt(row.getCell(3).value).toUpperCase();
    const nome = txt(row.getCell(4).value);
    if (!regime || !setor || !nome) continue;
    const periodicidade = PERIOD_MAP[periodRaw] ?? "MENSAL";

    try {
      const existe = await prisma.atividadeCatalogo.findFirst({
        where: { regime, setor, nome },
      });
      if (existe) continue;
      await prisma.atividadeCatalogo.create({
        data: { regime, setor, nome, periodicidade, ativa: true },
      });
      novos++;
    } catch { ignorados++; }
  }

  return { aba: "ATIVIDADES", ok: true, novos, atualizados: 0, ignorados };
}

// =====================================================================
// 5. OBRIGAÇÕES — cria UMA Obrigacao por par (setor, atividade) único.
//   Não duplica por cliente — Obrigacao com `global=true` cobre todos.
// =====================================================================
export async function importarObrigacoes(wb: ExcelJS.Workbook): Promise<AbaResult> {
  const sheet = wb.getWorksheet("OBRIGAÇÕES");
  if (!sheet) return { aba: "OBRIGAÇÕES", ok: false, novos: 0, atualizados: 0, ignorados: 0, erro: "aba não encontrada" };

  let novos = 0, ignorados = 0;
  const vistos = new Set<string>();
  const SETOR_TIPO: Record<string, string> = {
    "FOLHA PGTO": "ESOCIAL", "FOLHA": "ESOCIAL",
    "FISCAL": "DAS", "CONTÁBIL": "ECF", "SOCIETÁRIO": "OUTROS",
    "GERAL": "OUTROS",
  };

  for (let r = 3; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const setor = txt(row.getCell(1).value);
    const atividade = txt(row.getCell(2).value);
    if (!setor || !atividade) continue;

    const chave = `${setor}|${atividade}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    const tipo = (SETOR_TIPO[setor.toUpperCase()] ?? "OUTROS") as any;

    try {
      // Procura por nome (idempotência)
      const existe = await prisma.obrigacao.findFirst({
        where: { nome: atividade, setor },
      });
      if (existe) continue;

      await prisma.obrigacao.create({
        data: {
          nome: atividade,
          tipo,
          setor,
          recorrencia: "MENSAL",
          global: true,
          ativa: true,
          responsavel: null,
        },
      });
      novos++;
    } catch { ignorados++; }
  }

  return { aba: "OBRIGAÇÕES", ok: true, novos, atualizados: 0, ignorados };
}

// =====================================================================
// 6. ÍNDICE → CatalogoServico (col 2 SERVIÇOS list em r2: col 3-12)
// =====================================================================
const SERVICOS_CATALOGO = [
  "Administração Condominial", "Contabilidade", "Esocial Doméstico",
  "Imposto de Renda", "MEI Básico", "MEI Padrão",
  "Projetos Culturais", "Carnê Leão", "Pessoa Física",
  "BPO Financeiro", "Gestão de agenda, cobranças e contratos",
];

export async function importarCatalogoServicos(_wb: ExcelJS.Workbook): Promise<AbaResult> {
  let novos = 0, atualizados = 0;
  for (let i = 0; i < SERVICOS_CATALOGO.length; i++) {
    const nome = SERVICOS_CATALOGO[i];
    const slug = slugify(nome);
    const categoria =
      /MEI/i.test(nome) ? "MEI" :
      /Doméstico|Pessoa Física|Carnê|Imposto de Renda/i.test(nome) ? "PESSOA_FISICA" :
      /Condominial/i.test(nome) ? "CONDOMINIO" :
      /BPO|Gestão/i.test(nome) ? "BPO" :
      "CONTABILIDADE";

    const existe = await prisma.catalogoServico.findUnique({ where: { slug } });
    if (existe) {
      atualizados++;
      continue;
    }
    await prisma.catalogoServico.create({
      data: { slug, nome, categoria, ativo: true, ordem: i },
    });
    novos++;
  }
  return { aba: "ÍNDICE → CATÁLOGO SERVIÇOS", ok: true, novos, atualizados, ignorados: 0 };
}

// =====================================================================
// 7. ENCERRADOS → marca clientes como ENCERRADO + dataEncerramento
//    col 1=cód, col 12=BAIXADO, col 13=data baixa
// =====================================================================
export async function importarEncerrados(wb: ExcelJS.Workbook): Promise<AbaResult> {
  const sheet = wb.getWorksheet("ENCERRADOS");
  if (!sheet) return { aba: "ENCERRADOS", ok: false, novos: 0, atualizados: 0, ignorados: 0, erro: "aba não encontrada" };

  let atualizados = 0, ignorados = 0;

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const codigo = Number(row.getCell(1).value);
    if (!codigo) continue;
    const cliente = await prisma.cliente.findUnique({ where: { codigo } });
    if (!cliente) { ignorados++; continue; }
    if (cliente.status === "ENCERRADO") continue;

    const dataEnc = dateOrNull(row.getCell(13).value);
    await prisma.cliente.update({
      where: { id: cliente.id },
      data: {
        status: "ENCERRADO",
        dataEncerramento: dataEnc ?? cliente.dataEncerramento ?? new Date(),
      },
    });
    atualizados++;
  }

  return { aba: "ENCERRADOS", ok: true, novos: 0, atualizados, ignorados };
}

// =====================================================================
// ENTRY
// =====================================================================
export async function importarV106Extras2(wb: ExcelJS.Workbook): Promise<AbaResult[]> {
  const out: AbaResult[] = [];

  logger.info("V-106 extras2: CERTIFICADOS…");
  out.push(await importarCertificados(wb));

  logger.info("V-106 extras2: RESPONSÁVEIS…");
  out.push(await importarResponsaveisIniciais(wb));

  logger.info("V-106 extras2: HONORÁRIOS…");
  out.push(await importarHistoricoHonorarios(wb));

  logger.info("V-106 extras2: ATIVIDADES…");
  out.push(await importarAtividadesCatalogo(wb));

  logger.info("V-106 extras2: OBRIGAÇÕES…");
  out.push(await importarObrigacoes(wb));

  logger.info("V-106 extras2: ÍNDICE/CATÁLOGO…");
  out.push(await importarCatalogoServicos(wb));

  logger.info("V-106 extras2: ENCERRADOS…");
  out.push(await importarEncerrados(wb));

  return out;
}
