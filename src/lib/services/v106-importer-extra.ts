/**
 * Importadores adicionais da V-106 — abas que NÃO eram cobertas no v106-importer.ts:
 *   1. TEXTOS TAGS HUBLX     → TagTexto + TagAgendamento (as 30+ datas planejadas por tag)
 *   2. OBJETO SOCIAL         → ObjetoSocial (texto contratual por segmento × tributação)
 *   3. CLIENTE INDICA        → Indicacao (origem CLIENTE)
 *   4. PARCEIRO INDICA       → Parceiro + Indicacao (origem PARCEIRO)
 *   5. AGENDAS               → AgendaCalendar
 *   6. CONTRATOS - MALA EXCEL→ Cliente endereço estruturado (preenche vazios)
 *   7. TABELA HONORARIOS     → TabelaHonorario (calculadora de precificação)
 *
 * Foi separado do `v106-importer.ts` pra manter cada arquivo < 500 linhas.
 * Idempotente — pode rodar várias vezes sem duplicar (upsert por chave natural).
 */

import ExcelJS from "exceljs";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

export interface AbaResult {
  aba: string;
  ok: boolean;
  novos: number;
  atualizados: number;
  ignorados: number;
  detalhes?: { linha: number; razao?: string; motivo: string }[];
  erro?: string;
}

// ─────────────────────────────────────────────────────────────────────
// Helpers (duplicados aqui pra evitar dependência cruzada)
// ─────────────────────────────────────────────────────────────────────

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
    // serial Excel
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
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function soDigitos(s: string): string { return (s ?? "").replace(/\D/g, ""); }

function formatarCnpj(d: string): string {
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return d;
}

// =====================================================================
// 1. TEXTOS TAGS HUBLX
// Layout:
//   col 1 = TAG (nome — bate com headers de TAGS HUBLX)
//   col 2 = TÍTULO
//   col 3 = MENSAGEM (longa)
//   col 4 = MENSAGEM REDUZIDA
//   col 5 = PERIODICIDADE
//   col 6+ alternando: DATA, HORÁRIO, DATA, HORÁRIO… (cronograma 2023→2026)
// =====================================================================
export async function importarTextosTags(wb: ExcelJS.Workbook): Promise<AbaResult> {
  const sheet = wb.getWorksheet("TEXTOS TAGS HUBLX");
  if (!sheet) return { aba: "TEXTOS TAGS HUBLX", ok: false, novos: 0, atualizados: 0, ignorados: 0, erro: "aba não encontrada" };

  let novos = 0, atualizados = 0, ignorados = 0, agendamentos = 0;
  const detalhes: AbaResult["detalhes"] = [];

  // Linha 2 contém os cabeçalhos reais (TAG/TÍTULO/MENSAGEM/...)
  // Dados começam na linha 3.
  for (let r = 3; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const nomeTag = txt(row.getCell(1).value);
    if (!nomeTag) continue;

    const titulo = txt(row.getCell(2).value);
    const mensagem = txt(row.getCell(3).value);
    const mensagemReduzida = txt(row.getCell(4).value);
    const periodicidade = txt(row.getCell(5).value);

    if (!titulo && !mensagem) { ignorados++; continue; }

    const slug = slugify(nomeTag);
    const tag = await prisma.tag.findUnique({ where: { slug } });
    if (!tag) {
      ignorados++;
      if (detalhes!.length < 10) detalhes!.push({ linha: r, motivo: `Tag "${nomeTag}" (slug ${slug}) não encontrada — rode TAGS HUBLX primeiro` });
      continue;
    }

    // Upsert TagTexto principal (mensagem longa)
    const tituloFinal = titulo || `Mensagem ${nomeTag}`;
    const textoLongo = await prisma.tagTexto.findFirst({
      where: { tagId: tag.id, titulo: tituloFinal },
    });
    let tagTextoId: string;
    if (textoLongo) {
      await prisma.tagTexto.update({
        where: { id: textoLongo.id },
        data: { texto: mensagem || mensagemReduzida || "(sem mensagem)", canal: "whatsapp" },
      });
      atualizados++;
      tagTextoId = textoLongo.id;
    } else {
      const novo = await prisma.tagTexto.create({
        data: {
          tagId: tag.id,
          titulo: tituloFinal,
          texto: mensagem || mensagemReduzida || "(sem mensagem)",
          canal: "whatsapp",
        },
      });
      novos++;
      tagTextoId = novo.id;
    }

    // Versão reduzida (se distinta da longa) — Patrick: "01/04/26 lançou a reduzida"
    if (mensagemReduzida && mensagemReduzida !== mensagem) {
      const reduzidaTitulo = `${tituloFinal} (reduzida)`;
      const existeRed = await prisma.tagTexto.findFirst({
        where: { tagId: tag.id, titulo: reduzidaTitulo },
      });
      if (!existeRed) {
        await prisma.tagTexto.create({
          data: { tagId: tag.id, titulo: reduzidaTitulo, texto: mensagemReduzida, canal: "whatsapp" },
        });
      }
    }

    // Cronograma de envios (datas+horários a partir da col 6)
    // Layout: par (data, horário) — descobre quantos pares válidos existem
    for (let c = 6; c <= sheet.columnCount; c += 2) {
      const data = dateOrNull(row.getCell(c).value);
      const horario = txt(row.getCell(c + 1).value) || "08:00";
      if (!data) continue;
      // Idempotência: skip se já existe agendamento pra (tagTextoId, data)
      const existe = await prisma.tagAgendamento.findFirst({
        where: { tagTextoId, dataExecucao: data },
      });
      if (existe) continue;
      await prisma.tagAgendamento.create({
        data: { tagTextoId, dataExecucao: data, horarioEnvio: horario.slice(0, 5) },
      });
      agendamentos++;
    }

    if (detalhes!.length < 10 && periodicidade) {
      detalhes!.push({ linha: r, motivo: `${nomeTag}: ${periodicidade}` });
    }
  }

  return {
    aba: "TEXTOS TAGS HUBLX",
    ok: true,
    novos: novos + agendamentos,  // somamos pra ficar transparente
    atualizados,
    ignorados,
    detalhes: detalhes!.slice(0, 20),
  };
}

// =====================================================================
// 2. OBJETO SOCIAL (331 linhas: 1=CÓD, 4=TRIBUTAÇÃO, 5=OBJETO SOCIAL texto)
// Patrick: "preciso de texto pronto por seguimento × regime"
// =====================================================================
export async function importarObjetosSociais(wb: ExcelJS.Workbook): Promise<AbaResult> {
  const sheet = wb.getWorksheet("OBJETO SOCIAL ") || wb.getWorksheet("OBJETO SOCIAL");
  if (!sheet) return { aba: "OBJETO SOCIAL", ok: false, novos: 0, atualizados: 0, ignorados: 0, erro: "aba não encontrada" };

  let novos = 0, atualizados = 0, ignorados = 0;
  const vistos = new Set<string>();

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const codigo = Number(row.getCell(1).value);
    if (!codigo) continue;

    const tributacao = txt(row.getCell(4).value);
    const objeto = txt(row.getCell(5).value);
    if (!tributacao || !objeto || objeto.length < 10) { ignorados++; continue; }

    // Como segmento, usa o `seguimento` do cliente se conhecido — senão "GERAL"
    const cliente = await prisma.cliente.findUnique({ where: { codigo } });
    const segmento = cliente?.seguimento || cliente?.categoria || "GERAL";

    const chave = `${segmento}|${tributacao}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    const existente = await prisma.objetoSocial.findUnique({
      where: { segmento_tributacao: { segmento, tributacao } },
    });
    if (existente) {
      // Só atualiza se o texto da V106 for maior (presumimos = mais completo)
      if (objeto.length > existente.texto.length) {
        await prisma.objetoSocial.update({
          where: { id: existente.id },
          data: { texto: objeto },
        });
        atualizados++;
      }
    } else {
      await prisma.objetoSocial.create({
        data: { segmento, tributacao, texto: objeto, ativo: true },
      });
      novos++;
    }
  }

  return { aba: "OBJETO SOCIAL", ok: true, novos, atualizados, ignorados };
}

// =====================================================================
// 3. CLIENTE INDICA (col 2=CLIENTE INDICADOR, col 4=CLIENTE INDICADO,
//    col 5=SERVIÇO, col 6=NOME AMIGO, col 7=QUANDO, col 8=PRAZO, col 9=VOUCHER,
//    col 10=STATUS, col 11=DATA USO)
// =====================================================================
export async function importarClienteIndica(wb: ExcelJS.Workbook): Promise<AbaResult> {
  const sheet = wb.getWorksheet("CLIENTE INDICA");
  if (!sheet) return { aba: "CLIENTE INDICA", ok: false, novos: 0, atualizados: 0, ignorados: 0, erro: "aba não encontrada" };

  let novos = 0, atualizados = 0, ignorados = 0;
  const detalhes: AbaResult["detalhes"] = [];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const nomeIndicador = txt(row.getCell(2).value);
    const nomeIndicado = txt(row.getCell(4).value);
    const servico = txt(row.getCell(5).value) || "ABERTURA DE EMPRESA";
    const dataInd = dateOrNull(row.getCell(7).value);
    const prazo = dateOrNull(row.getCell(8).value);
    const voucherValor = Number(txt(row.getCell(9).value).replace(/[^\d.,-]/g, "").replace(",", ".")) || null;
    const statusRaw = txt(row.getCell(10).value).toUpperCase();
    const obs = txt(row.getCell(11).value);

    if (!nomeIndicador || !dataInd) { ignorados++; continue; }

    const status: "UTILIZADO" | "PENDENTE" | "EXPIRADO" | "CANCELADO" =
      statusRaw.includes("UTILIZ") ? "UTILIZADO" :
      statusRaw.includes("EXPIR")  ? "EXPIRADO" :
      statusRaw.includes("CANCEL") ? "CANCELADO" :
      "PENDENTE";

    // Resolve clientes por razão social aproximada
    const indicador = await prisma.cliente.findFirst({
      where: { razaoSocial: { contains: nomeIndicador.slice(0, 20), mode: "insensitive" }, deletedAt: null },
    });
    const indicado = nomeIndicado
      ? await prisma.cliente.findFirst({
          where: { razaoSocial: { contains: nomeIndicado.slice(0, 20), mode: "insensitive" }, deletedAt: null },
        })
      : null;

    // Chave de idempotência: (indicador, indicado, dataIndicacao)
    const existente = await prisma.indicacao.findFirst({
      where: {
        origem: "CLIENTE",
        indicadorClienteId: indicador?.id,
        nomeAmigo: indicado ? null : (nomeIndicado || null),
        dataIndicacao: dataInd,
      },
    });

    if (existente) { atualizados++; continue; }

    try {
      await prisma.indicacao.create({
        data: {
          origem: "CLIENTE",
          indicadorClienteId: indicador?.id,
          nomeAmigo: indicador ? null : nomeIndicador,
          indicadoClienteId: indicado?.id,
          servico,
          dataIndicacao: dataInd,
          prazoUso: prazo,
          voucherValor,
          status,
          dataUso: status === "UTILIZADO" ? prazo : null,
          observacao: obs || null,
        },
      });
      novos++;
    } catch (e: any) {
      ignorados++;
      if (detalhes!.length < 10) detalhes!.push({ linha: r, motivo: String(e?.message ?? e).slice(0, 200) });
    }
  }

  return { aba: "CLIENTE INDICA", ok: true, novos, atualizados, ignorados, detalhes: detalhes!.slice(0, 20) };
}

// =====================================================================
// 4. PARCEIRO INDICA (col 1=PARCEIRO, col 2=CPF/CNPJ, col 3=COD CLIENTE,
//    col 4=CLIENTE, col 5=INÍCIO, col 6=VALOR, col 7=MÊS PGTO, col 8=STATUS)
// =====================================================================
export async function importarParceiroIndica(wb: ExcelJS.Workbook): Promise<AbaResult> {
  const sheet = wb.getWorksheet("PARCEIRO INDICA");
  if (!sheet) return { aba: "PARCEIRO INDICA", ok: false, novos: 0, atualizados: 0, ignorados: 0, erro: "aba não encontrada" };

  let novos = 0, atualizados = 0, ignorados = 0;

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const nomeParc = txt(row.getCell(1).value);
    const cpfCnpj = soDigitos(txt(row.getCell(2).value));
    const codCliente = Number(row.getCell(3).value);
    const dataInicio = dateOrNull(row.getCell(5).value);
    const valor = Number(txt(row.getCell(6).value).replace(/[^\d.,-]/g, "").replace(",", ".")) || null;
    const mesPgto = dateOrNull(row.getCell(7).value);
    const statusRaw = txt(row.getCell(8).value).toUpperCase();

    if (!nomeParc || !cpfCnpj) { ignorados++; continue; }

    // Upsert Parceiro
    const cpfCnpjFmt = formatarCnpj(cpfCnpj);
    const parceiro = await prisma.parceiro.upsert({
      where: { cpfCnpj: cpfCnpjFmt },
      create: { nome: nomeParc, cpfCnpj: cpfCnpjFmt, ativo: true },
      update: { nome: nomeParc },
    });

    const cliente = codCliente ? await prisma.cliente.findUnique({ where: { codigo: codCliente } }) : null;

    const status: "UTILIZADO" | "PENDENTE" =
      statusRaw === "PAGO" || statusRaw === "UTILIZADO" ? "UTILIZADO" : "PENDENTE";

    // Idempotência: (parceiro, cliente, dataInicio)
    const existente = await prisma.indicacao.findFirst({
      where: {
        origem: "PARCEIRO",
        indicadorParceiroId: parceiro.id,
        indicadoClienteId: cliente?.id,
        dataIndicacao: dataInicio ?? undefined,
      },
    });
    if (existente) { atualizados++; continue; }

    try {
      await prisma.indicacao.create({
        data: {
          origem: "PARCEIRO",
          indicadorParceiroId: parceiro.id,
          indicadoClienteId: cliente?.id,
          servico: "ABERTURA DE EMPRESA",
          dataIndicacao: dataInicio ?? new Date(),
          voucherValor: valor,
          status,
          dataUso: status === "UTILIZADO" ? mesPgto : null,
        },
      });
      novos++;
    } catch {
      ignorados++;
    }
  }

  return { aba: "PARCEIRO INDICA", ok: true, novos, atualizados, ignorados };
}

// =====================================================================
// 5. AGENDAS (col 2=NOME, col 3=COR, col 4=DESCRIÇÃO, col 5=EMAIL, col 6=PADRÃO)
// =====================================================================
const CORES_BR: Record<string, string> = {
  banana: "#FACC15", purpura: "#A855F7", "púrpura": "#A855F7", manjericao: "#10B981",
  "manjericão": "#10B981", lavanda: "#C4B5FD", flamingo: "#F472B6", tangerina: "#FB923C",
  graphite: "#64748B", grafite: "#64748B", sálvia: "#84CC16", salvia: "#84CC16",
};

export async function importarAgendas(wb: ExcelJS.Workbook): Promise<AbaResult> {
  const sheet = wb.getWorksheet("AGENDAS");
  if (!sheet) return { aba: "AGENDAS", ok: false, novos: 0, atualizados: 0, ignorados: 0, erro: "aba não encontrada" };

  let novos = 0, atualizados = 0, ignorados = 0;

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const nome = txt(row.getCell(2).value);
    if (!nome) continue;
    const corNome = txt(row.getCell(3).value).toLowerCase();
    const descricao = txt(row.getCell(4).value);
    const email = txt(row.getCell(5).value).toLowerCase();
    const padrao = txt(row.getCell(6).value);
    if (!email) { ignorados++; continue; }

    const cor = CORES_BR[corNome] || "#6366F1";

    const existente = await prisma.agendaCalendar.findUnique({ where: { nome } });
    if (existente) {
      await prisma.agendaCalendar.update({
        where: { id: existente.id },
        data: { cor, descricao: descricao || existente.descricao, proprietarioEmail: email, padraoTitulo: padrao || existente.padraoTitulo },
      });
      atualizados++;
    } else {
      await prisma.agendaCalendar.create({
        data: { nome, cor, descricao: descricao || null, proprietarioEmail: email, padraoTitulo: padrao || null, ativa: true },
      });
      novos++;
    }
  }

  return { aba: "AGENDAS", ok: true, novos, atualizados, ignorados };
}

// =====================================================================
// 6. CONTRATOS - MALA EXCEL: preenche endereço estruturado do Cliente
// col 1=CÓD, col 4=LOG EMP, col 5=N END, col 7=COMPL, col 8=BAIRRO,
// col 9=MUN, col 10=CEP, col 11=REP LEGAL, col 12=CPF REP LEGAL
// =====================================================================
export async function importarMalaContratos(wb: ExcelJS.Workbook): Promise<AbaResult> {
  const sheet = wb.getWorksheet("CONTRATOS - MALA EXCEL");
  if (!sheet) return { aba: "CONTRATOS - MALA EXCEL", ok: false, novos: 0, atualizados: 0, ignorados: 0, erro: "aba não encontrada" };

  let atualizados = 0, ignorados = 0;

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const codigo = Number(row.getCell(1).value);
    if (!codigo) continue;
    const cliente = await prisma.cliente.findUnique({ where: { codigo } });
    if (!cliente) { ignorados++; continue; }

    const logradouro = txt(row.getCell(4).value);
    const numero = txt(row.getCell(5).value);
    const complemento = txt(row.getCell(7).value);
    const bairro = txt(row.getCell(8).value);
    const municipio = txt(row.getCell(9).value);
    const cep = soDigitos(txt(row.getCell(10).value));

    // Só atualiza o que está vazio (não sobrescreve o que já foi preenchido manual)
    const c = cliente as any;
    const patch: any = {};
    if (logradouro && !c.enderecoLogradouro) patch.enderecoLogradouro = logradouro;
    if (numero && !c.enderecoNumero) patch.enderecoNumero = numero;
    if (complemento && !c.enderecoComplemento) patch.enderecoComplemento = complemento;
    if (bairro && !c.enderecoBairro) patch.enderecoBairro = bairro;
    if (municipio && !c.enderecoMunicipio) {
      const partes = municipio.split("/");
      patch.enderecoMunicipio = partes[0]?.trim();
      if (partes[1] && !c.enderecoUf) patch.enderecoUf = partes[1].trim().slice(0, 2).toUpperCase();
    }
    if (cep && cep.length === 8 && !c.enderecoCep) {
      patch.enderecoCep = `${cep.slice(0, 5)}-${cep.slice(5)}`;
    }

    if (Object.keys(patch).length > 0) {
      await prisma.cliente.update({ where: { id: cliente.id }, data: patch });
      atualizados++;
    }
  }

  return { aba: "CONTRATOS - MALA EXCEL", ok: true, novos: 0, atualizados, ignorados };
}

// =====================================================================
// 7. TABELA HONORARIOS: por enquanto cria entradas de calculadora.
// Layout muito variável — fazemos uma extração conservadora que captura
// linhas que tenham (categoria, nivel, valorMinimo).
// =====================================================================
export async function importarTabelaHonorarios(wb: ExcelJS.Workbook): Promise<AbaResult> {
  const sheet = wb.getWorksheet("TABELA HONORARIOS");
  if (!sheet) return { aba: "TABELA HONORARIOS", ok: false, novos: 0, atualizados: 0, ignorados: 0, erro: "aba não encontrada" };

  let novos = 0, ignorados = 0;
  const vigenciaInicio = new Date(2024, 0, 1); // Patrick: tabela vigente desde 2024
  const NIVEIS = ["BÁSICO", "PADRÃO", "TOTAL", "TOP"];

  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    // Procura padrão (categoria, nivel, valor)
    for (let c = 1; c <= sheet.columnCount; c++) {
      const cell = txt(row.getCell(c).value).toUpperCase();
      if (!NIVEIS.includes(cell)) continue;
      // Tenta achar a categoria 1 ou 2 colunas antes
      let categoria = "";
      for (let back = 1; back <= 3 && c - back >= 1; back++) {
        const candidato = txt(row.getCell(c - back).value);
        if (candidato && candidato.length > 3 && !NIVEIS.includes(candidato.toUpperCase())) {
          categoria = candidato; break;
        }
      }
      if (!categoria) continue;
      // Valor: próxima célula numérica
      let valor = 0;
      for (let fwd = 1; fwd <= 3 && c + fwd <= sheet.columnCount; fwd++) {
        const v = Number(txt(row.getCell(c + fwd).value).replace(/[^\d.,-]/g, "").replace(",", "."));
        if (v > 0) { valor = v; break; }
      }
      if (!valor) continue;

      try {
        await prisma.tabelaHonorario.create({
          data: { nivel: cell, categoria, valorMinimo: valor, vigenciaInicio },
        });
        novos++;
      } catch { ignorados++; }
      break; // só uma entrada por linha
    }
  }

  return { aba: "TABELA HONORARIOS", ok: true, novos, atualizados: 0, ignorados };
}

// =====================================================================
// ENTRY POINT — chama todas as 7 abas extras em sequência
// =====================================================================
export async function importarV106Extras(wb: ExcelJS.Workbook): Promise<AbaResult[]> {
  const out: AbaResult[] = [];

  logger.info("V-106 extras: TEXTOS TAGS HUBLX…");
  out.push(await importarTextosTags(wb));

  logger.info("V-106 extras: OBJETO SOCIAL…");
  out.push(await importarObjetosSociais(wb));

  logger.info("V-106 extras: CLIENTE INDICA…");
  out.push(await importarClienteIndica(wb));

  logger.info("V-106 extras: PARCEIRO INDICA…");
  out.push(await importarParceiroIndica(wb));

  logger.info("V-106 extras: AGENDAS…");
  out.push(await importarAgendas(wb));

  logger.info("V-106 extras: CONTRATOS - MALA EXCEL…");
  out.push(await importarMalaContratos(wb));

  logger.info("V-106 extras: TABELA HONORARIOS…");
  out.push(await importarTabelaHonorarios(wb));

  return out;
}
