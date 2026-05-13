/**
 * Rotinas de retenção / expurgo. Rodam via cron mensal.
 *
 * - expurgarAuditLogsAntigos(): deleta audit logs > retençãoDias
 * - expurgarUploadsOrfaos(): deleta arquivos em /uploads que não têm referência no DB
 * - expurgarMessageLogsAntigos(): compacta MessageLog pra só últimos N dias
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { connectMongo } from "@/lib/db/mongo";
import { logger } from "@/lib/logger";
import { expurgarAuditAntigos } from "@/lib/security/audit";

const DIAS = 86_400_000;

export async function expurgarAuditLogsAntigos(retencaoDias = 365) {
  const qtd = await expurgarAuditAntigos(retencaoDias);
  logger.info("expurgo.audit", { qtd, retencaoDias });
  return { tabela: "audit_logs", removidos: qtd };
}

export async function expurgarMessageLogsAntigos(retencaoDias = 180) {
  await connectMongo();
  const { MessageLogModel } = await import("@/models/MessageLog");
  const corte = new Date(Date.now() - retencaoDias * DIAS);
  const r = await MessageLogModel.deleteMany({ createdAt: { $lt: corte } });
  logger.info("expurgo.message_logs", { qtd: r.deletedCount, retencaoDias });
  return { tabela: "message_logs", removidos: r.deletedCount };
}

export async function expurgarFormResponsesAntigos(retencaoDias = 730) {
  await connectMongo();
  const { FormResponseModel } = await import("@/models/FormResponse");
  const corte = new Date(Date.now() - retencaoDias * DIAS);
  // Só expurga RECEBIDO ou REJEITADO — APLICADO fica indefinidamente (histórico)
  const r = await FormResponseModel.deleteMany({
    createdAt: { $lt: corte },
    status: { $in: ["RECEBIDO", "REJEITADO"] },
  });
  logger.info("expurgo.form_responses", { qtd: r.deletedCount, retencaoDias });
  return { tabela: "form_responses", removidos: r.deletedCount };
}

/**
 * Varre /uploads e remove arquivos sem referência.
 * Referências hoje vivem em: Contrato.docxPath/pdfPath, FormResponse.files (Mongo),
 * ContratoTemplate.arquivoDocx. Qualquer hash não citado em nenhum desses pode sair.
 */
export async function expurgarUploadsOrfaos(dryRun = false) {
  const baseDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(baseDir)) return { verificados: 0, removidos: 0 };

  const referenciados = new Set<string>();

  // Contratos
  const contratos = await prisma.contrato.findMany({ select: { docxPath: true, pdfPath: true } });
  for (const c of contratos) {
    if (c.docxPath) referenciados.add(path.basename(c.docxPath));
    if (c.pdfPath) referenciados.add(path.basename(c.pdfPath));
  }

  // Templates
  const templates = await prisma.contratoTemplate.findMany({ select: { arquivoDocx: true } });
  for (const t of templates) if (t.arquivoDocx) referenciados.add(path.basename(t.arquivoDocx));

  // Form responses no Mongo (só os ativos)
  try {
    await connectMongo();
    const { FormResponseModel } = await import("@/models/FormResponse");
    const resps: any[] = await FormResponseModel.find({ "answers": { $exists: true } })
      .select("answers files")
      .lean();
    for (const r of resps) {
      const flat = JSON.stringify(r);
      // Procura padrões /api/files/<hash>.<ext>
      const matches = flat.match(/\/api\/files\/[a-f0-9]+\.[a-z]+/gi) ?? [];
      for (const m of matches) {
        const base = m.split("/").pop()!;
        referenciados.add(base);
      }
    }
  } catch (err) {
    logger.warn("expurgo.mongo_indisponivel", { err: String(err) });
  }

  // Varre diretórios
  function varrerDir(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const saida: string[] = [];
    for (const nome of fs.readdirSync(dir)) {
      const full = path.join(dir, nome);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) saida.push(...varrerDir(full));
      else saida.push(full);
    }
    return saida;
  }

  const todos = varrerDir(baseDir);
  const umMesAtras = Date.now() - 30 * DIAS;

  let removidos = 0;
  for (const file of todos) {
    const base = path.basename(file);
    if (referenciados.has(base)) continue;
    // Só remove arquivos com mais de 30 dias (garantia contra race de upload recente)
    const stat = fs.statSync(file);
    if (stat.mtimeMs > umMesAtras) continue;
    if (!dryRun) fs.unlinkSync(file);
    removidos++;
  }

  logger.info("expurgo.uploads", { verificados: todos.length, removidos, dryRun });
  return { verificados: todos.length, removidos, dryRun };
}

/**
 * Roda tudo. Chamado via /api/cron/expurgo ou agendado mensalmente.
 */
export async function rodarExpurgoMensal() {
  logger.info("expurgo.iniciado");
  const resultados = [];
  try { resultados.push(await expurgarAuditLogsAntigos()); } catch (e) { logger.error("expurgo.audit_falhou", e); }
  try { resultados.push(await expurgarMessageLogsAntigos()); } catch (e) { logger.error("expurgo.msg_falhou", e); }
  try { resultados.push(await expurgarFormResponsesAntigos()); } catch (e) { logger.error("expurgo.forms_falhou", e); }
  try {
    const r = await expurgarUploadsOrfaos();
    resultados.push({ tabela: "uploads", ...r });
  } catch (e) { logger.error("expurgo.uploads_falhou", e); }
  logger.info("expurgo.concluido", { resultados });
  return resultados;
}
