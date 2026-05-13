/**
 * Aniversário de sócios e empresas — disparo automático de mensagem WhatsApp.
 *
 * Patrick (24/04/2026):
 * - "Aniversário do sócio: vem do formulário, vira mensagem"
 * - "Aniversário da empresa: data de constituição → 'sua empresa fez 2 anos'"
 *
 * Roda 1x por dia (cron 09:00). Para cada cliente ativo:
 *   1. Verifica se a data de constituição (mês/dia) bate com hoje → mensagem empresa
 *   2. Para cada sócio com dataNascimento (mês/dia) batendo com hoje → mensagem sócio
 *
 * Idempotente: registra envio no AuditLog com action "aniversario.{tipo}.{ano}"
 * para não enviar duas vezes no mesmo ano.
 */

import { prisma } from "@/lib/db/prisma";
import { enviarMensagem as digisacEnviar, upsertContato } from "@/lib/services/digisac";
import { connectMongo } from "@/lib/db/mongo";
import { MessageLogModel } from "@/models/MessageLog";
import { logger } from "@/lib/logger";

const TEMPLATE_SOCIO_PADRAO = `🎉 *Parabéns, {nome}!* 🎂

A equipe da Cestacorp deseja a você um feliz aniversário!
Que este novo ciclo seja repleto de saúde, prosperidade e realizações pessoais e profissionais.

Conte sempre com a gente! 💙💚`;

const TEMPLATE_EMPRESA_PADRAO = `🎂 *{nomeFantasia}* completa hoje *{anos} ano{plural}*! 🎉

A Cestacorp parabeniza você por mais um ciclo de jornada empresarial.
Que venham muitos anos de sucesso, crescimento e conquistas.

Estamos honrados em fazer parte da sua história. 💙💚`;

function mesmoDiaMes(d1: Date, d2: Date): boolean {
  return d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function aplicar(template: string, vars: Record<string, string | number>): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return out;
}

/**
 * Envia mensagem via Digisac priorizando grupo do cliente (Patrick: comunicamos via grupo).
 * Fallback: telefone do sócio.
 */
async function enviarWhatsappCliente(
  cliente: any,
  mensagem: string,
  contextoTipo: string,
  contextoId: string
): Promise<{ ok: boolean; messageId?: string; erro?: string }> {
  try {
    let envio: { id: string };
    let destino: string;

    if (cliente.whatsappGrupoId) {
      envio = await digisacEnviar({
        contactId: cliente.whatsappGrupoId,
        number: cliente.whatsappGrupoId,
        text: mensagem,
      });
      destino = `grupo:${cliente.whatsappGrupoNome ?? cliente.whatsappGrupoId}`;
    } else {
      const tel = cliente.telefones.find((t: any) => t.whatsapp && t.principal)
               || cliente.telefones.find((t: any) => t.whatsapp)
               || cliente.telefones[0];
      if (!tel) return { ok: false, erro: "sem grupo nem telefone" };

      let contactId = cliente.digisacContactId;
      if (!contactId) {
        const contato = await upsertContato({ name: cliente.razaoSocial, number: tel.numero });
        contactId = contato.id;
        await prisma.cliente.update({
          where: { id: cliente.id },
          data: { digisacContactId: contactId },
        });
      }
      envio = await digisacEnviar({ contactId, number: tel.numero, text: mensagem });
      destino = tel.numero;
    }

    // Log no Mongo
    try {
      await connectMongo();
      await MessageLogModel.create({
        canal: "WHATSAPP",
        direcao: "OUT",
        clienteId: cliente.id,
        para: destino,
        conteudo: mensagem,
        provider: "digisac",
        providerMessageId: envio.id,
        providerPayload: envio,
        status: "ENVIADO",
        meta: { tipo: contextoTipo, contextoId },
      });
    } catch (logErr) {
      logger.warn("Aniversário: falha ao logar no Mongo", { err: String(logErr) });
    }

    return { ok: true, messageId: envio.id };
  } catch (err: any) {
    return { ok: false, erro: String(err?.message ?? err).slice(0, 200) };
  }
}

/**
 * Já enviou hoje? Verifica via AuditLog (1 por ano por sócio/cliente).
 */
async function jaEnviouEsteAno(action: string, resourceId: string, anoAtual: number): Promise<boolean> {
  const inicioAno = new Date(anoAtual, 0, 1);
  const log = await prisma.auditLog.findFirst({
    where: {
      action,
      resourceId,
      createdAt: { gte: inicioAno },
    },
  });
  return Boolean(log);
}

async function registrar(action: string, resourceId: string, payload: any) {
  await prisma.auditLog.create({
    data: {
      actorId: "system",
      actorType: "system",
      actorEmail: "cron:aniversarios",
      action,
      resource: "aniversario",
      resourceId,
      after: payload,
    },
  });
}

/**
 * Processa todos os aniversários do dia (sócios + empresas).
 * Retorna estatísticas pra log do cron.
 */
export async function processarAniversariosDoDia(opts?: {
  hoje?: Date;
  /** Se true, não envia — só lista quem completaria. */
  dryRun?: boolean;
}): Promise<{
  hoje: string;
  socios: { total: number; enviados: number; pulados: number; erros: number; detalhes: any[] };
  empresas: { total: number; enviados: number; pulados: number; erros: number; detalhes: any[] };
}> {
  const hoje = opts?.hoje ?? new Date();
  const ano = hoje.getFullYear();
  const dryRun = opts?.dryRun ?? false;

  const sociosStats = { total: 0, enviados: 0, pulados: 0, erros: 0, detalhes: [] as any[] };
  const empresasStats = { total: 0, enviados: 0, pulados: 0, erros: 0, detalhes: [] as any[] };

  // ===== EMPRESAS (data de constituição) =====
  const clientes = await prisma.cliente.findMany({
    where: {
      status: "ATIVO",
      dataConstituicao: { not: null },
    },
    include: { telefones: true, socios: true },
  });

  for (const c of clientes) {
    if (!c.dataConstituicao) continue;
    if (!mesmoDiaMes(c.dataConstituicao, hoje)) continue;

    empresasStats.total++;
    const action = `aniversario.empresa.${ano}`;
    if (await jaEnviouEsteAno(action, c.id, ano)) {
      empresasStats.pulados++;
      empresasStats.detalhes.push({ clienteId: c.id, motivo: "já enviou neste ano" });
      continue;
    }

    const anos = ano - c.dataConstituicao.getFullYear();
    const mensagem = aplicar(TEMPLATE_EMPRESA_PADRAO, {
      nomeFantasia: c.nomeFantasia ?? c.razaoSocial,
      razaoSocial: c.razaoSocial,
      anos,
      plural: anos === 1 ? "" : "s",
    });

    if (dryRun) {
      empresasStats.detalhes.push({ clienteId: c.id, anos, dryRun: true, preview: mensagem.slice(0, 60) });
      continue;
    }

    const r = await enviarWhatsappCliente(c, mensagem, "aniversario_empresa", c.id);
    if (r.ok) {
      empresasStats.enviados++;
      await registrar(action, c.id, { anos, messageId: r.messageId });
      empresasStats.detalhes.push({ clienteId: c.id, anos, messageId: r.messageId });
    } else {
      empresasStats.erros++;
      empresasStats.detalhes.push({ clienteId: c.id, erro: r.erro });
    }
  }

  // ===== SÓCIOS (data de nascimento) =====
  const socios = await prisma.socio.findMany({
    where: {
      dataNascimento: { not: null },
      cliente: { status: "ATIVO" },
    },
    include: {
      cliente: { include: { telefones: true } },
    },
  });

  for (const s of socios) {
    if (!s.dataNascimento) continue;
    if (!mesmoDiaMes(s.dataNascimento, hoje)) continue;

    sociosStats.total++;
    const action = `aniversario.socio.${ano}`;
    if (await jaEnviouEsteAno(action, s.id, ano)) {
      sociosStats.pulados++;
      continue;
    }

    const idade = ano - s.dataNascimento.getFullYear();
    const mensagem = aplicar(TEMPLATE_SOCIO_PADRAO, {
      nome: s.nome,
      idade,
    });

    if (dryRun) {
      sociosStats.detalhes.push({ socioId: s.id, nome: s.nome, idade, dryRun: true });
      continue;
    }

    const r = await enviarWhatsappCliente(s.cliente, mensagem, "aniversario_socio", s.id);
    if (r.ok) {
      sociosStats.enviados++;
      await registrar(action, s.id, { idade, messageId: r.messageId, clienteId: s.clienteId });
      sociosStats.detalhes.push({ socioId: s.id, nome: s.nome, idade, messageId: r.messageId });
    } else {
      sociosStats.erros++;
      sociosStats.detalhes.push({ socioId: s.id, nome: s.nome, erro: r.erro });
    }
  }

  return {
    hoje: hoje.toISOString().slice(0, 10),
    socios: sociosStats,
    empresas: empresasStats,
  };
}
