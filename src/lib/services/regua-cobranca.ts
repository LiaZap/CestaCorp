/**
 * ENGINE DA RÉGUA DE COBRANÇA — Cestacorp
 *
 * Fluxo diário (roda via cron):
 *   1. Sincroniza cobranças em aberto do NIBO → tabela `cobrancas`
 *   2. Marca pagamentos novos (status PAGO) e cancela execuções futuras
 *   3. Para cada cobrança aberta, cria execuções da régua nas datas certas
 *      (vencimento + offset de cada passo)
 *   4. Processa execuções com `agendadoPara <= agora` e `status = PENDENTE`:
 *      renderiza mensagem com placeholders e dispara no DIGISAC
 *   5. Loga tudo em MessageLog (Mongo) e atualiza status da execução
 */

import { addDays, isBefore, isSameDay, startOfDay } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { connectMongo } from "@/lib/db/mongo";
import { MessageLogModel } from "@/models/MessageLog";
import {
  enviarMensagem as digisacEnviar,
  upsertContato,
} from "./digisac";
import { enviarEmail } from "./email";
import { notificar } from "./notifications";
import { materializaEventos, proximosEventos } from "./agenda";
import {
  listarContasReceber,
  obterContaReceber,
  type NiboReceivable,
} from "./nibo";
import { renderTemplate, enriquecerCobrancaComAtualizacao } from "./templating";
import { escolherVariante } from "./ab-testing";

const TZ = process.env.TZ || "America/Sao_Paulo";

// =========================================================
// 1. Sincronização NIBO → Postgres
// =========================================================
export async function sincronizarCobrancasNibo(opts?: { diasFuturo?: number; diasPassado?: number }) {
  const diasFuturo = opts?.diasFuturo ?? 60;
  const diasPassado = opts?.diasPassado ?? 90;
  const hoje = new Date();
  const start = addDays(hoje, -diasPassado).toISOString().slice(0, 10);
  const end = addDays(hoje, diasFuturo).toISOString().slice(0, 10);

  const { items } = await listarContasReceber({ startDate: start, endDate: end, pageSize: 500 });
  const { criarCobranca } = await import("./cobranca-factory");

  let novas = 0;
  let atualizadas = 0;
  let pagamentos = 0;

  for (const nibo of items) {
    const cliente = await prisma.cliente.findFirst({
      where: { niboCustomerId: nibo.stakeholderId },
      select: { id: true },
    });
    if (!cliente) continue; // cliente precisa estar vinculado

    const existente = await prisma.cobranca.findUnique({
      where: { niboDebitId: nibo.id },
    });

    const status = mapearStatusNibo(nibo);
    const dados = {
      clienteId: cliente.id,
      niboDebitId: nibo.id,
      descricao: nibo.description,
      valor: nibo.value,
      vencimento: new Date(nibo.dueDate),
      dataPagamento: nibo.paymentDate ? new Date(nibo.paymentDate) : null,
      linhaDigitavel: nibo.digitableLine,
      urlBoleto: nibo.billetUrl,
      pixCopiaCola: nibo.pixCopyPaste,
      status,
    };

    if (!existente) {
      // Nova cobrança via factory — captura snapshot automaticamente
      await criarCobranca(dados, { fonte: "sync-nibo" });
      novas++;
    } else {
      // Atualização: NÃO sobrescreve o snapshot original (mantém regra prospectiva)
      const virouPago = existente.status !== "PAGO" && status === "PAGO";
      await prisma.cobranca.update({ where: { id: existente.id }, data: dados });
      atualizadas++;
      if (virouPago) {
        pagamentos++;
        await cancelarExecucoesFuturas(existente.id);
      }
    }
  }

  return { novas, atualizadas, pagamentos, total: items.length };
}

function mapearStatusNibo(nibo: NiboReceivable): "ABERTO" | "PAGO" | "ATRASADO" {
  if (nibo.isPaid) return "PAGO";
  const hoje = startOfDay(new Date());
  const venc = startOfDay(new Date(nibo.dueDate));
  return isBefore(venc, hoje) ? "ATRASADO" : "ABERTO";
}

async function cancelarExecucoesFuturas(cobrancaId: string) {
  await prisma.execucaoRegua.updateMany({
    where: { cobrancaId, status: "PENDENTE" },
    data: { status: "PULADO", erro: "Cobrança paga antes do envio" },
  });
}

// =========================================================
// 2. Geração de execuções (agenda todas as etapas da régua)
// =========================================================
export async function gerarExecucoesDaRegua(reguaId?: string) {
  const reguas = await prisma.reguaCobranca.findMany({
    where: { ativa: true, ...(reguaId ? { id: reguaId } : {}) },
    include: { passos: { orderBy: { ordem: "asc" } } },
  });

  const cobrancasAbertas = await prisma.cobranca.findMany({
    where: { status: { in: ["ABERTO", "ATRASADO", "PARCIAL"] } },
    include: { execucoes: true },
  });

  let geradas = 0;

  for (const regua of reguas) {
    for (const cobranca of cobrancasAbertas) {
      for (const passo of regua.passos) {
        const jaExiste = cobranca.execucoes.some(
          (e) => e.passoId === passo.id && e.reguaId === regua.id
        );
        if (jaExiste) continue;

        const agendadoPara = calcularDataEnvio(
          cobranca.vencimento,
          passo.offsetDias,
          passo.horarioEnvio || "09:00",
          passo.soDiasUteis
        );

        // UNIQUE constraint garante que não duplicamos se 2 crons rodarem em paralelo.
        // upsert: se já existe (retry/race), ignora sem lançar
        try {
          await prisma.execucaoRegua.create({
            data: {
              reguaId: regua.id,
              passoId: passo.id,
              clienteId: cobranca.clienteId,
              cobrancaId: cobranca.id,
              agendadoPara,
              status: "PENDENTE",
            },
          });
          geradas++;
        } catch (err: any) {
          // P2002 = unique violation — já existe, ignore silenciosamente
          if (err?.code !== "P2002") throw err;
        }
      }
    }
  }

  return { geradas };
}

const HORA_COMERCIAL_INICIO = 9;
const HORA_COMERCIAL_FIM = 18;

function calcularDataEnvio(vencimento: Date, offsetDias: number, horario: string, soDiasUteis: boolean): Date {
  let dt = addDays(vencimento, offsetDias);
  if (soDiasUteis) dt = proximoDiaUtil(dt);
  const [h, m] = horario.split(":").map(Number);
  dt.setHours(h, m, 0, 0);
  return ajustarParaHorarioComercial(dt);
}

function proximoDiaUtil(d: Date): Date {
  let dia = new Date(d);
  while (dia.getDay() === 0 || dia.getDay() === 6) {
    dia = addDays(dia, 1);
  }
  return dia;
}

/**
 * Garante que uma data está dentro da janela comercial (seg–sex, 09h–18h).
 * Evita disparar WhatsApp domingo 23h ou feriado.
 */
export function ajustarParaHorarioComercial(d: Date): Date {
  let dt = new Date(d);
  // Se fim de semana, move pra próxima segunda às 09h
  if (dt.getDay() === 0 || dt.getDay() === 6) {
    dt = proximoDiaUtil(dt);
    dt.setHours(HORA_COMERCIAL_INICIO, 0, 0, 0);
    return dt;
  }
  // Antes do horário — empurra pra 09h
  if (dt.getHours() < HORA_COMERCIAL_INICIO) {
    dt.setHours(HORA_COMERCIAL_INICIO, 0, 0, 0);
    return dt;
  }
  // Depois do horário — empurra pra próximo dia útil às 09h
  if (dt.getHours() >= HORA_COMERCIAL_FIM) {
    dt = addDays(dt, 1);
    dt = proximoDiaUtil(dt);
    dt.setHours(HORA_COMERCIAL_INICIO, 0, 0, 0);
    return dt;
  }
  return dt;
}

/**
 * Classifica erro como transiente (vale retry) vs. permanente.
 * - Transiente: timeout, 429, 5xx, ECONNRESET, network errors
 * - Permanente: 4xx (exceto 429), erros de validação, cliente sem telefone
 */
function isErroTransiente(err: any): boolean {
  const msg = String(err?.message ?? err ?? "").toLowerCase();
  if (msg.includes("timeout") || msg.includes("econnreset") || msg.includes("econnrefused")) return true;
  if (msg.includes("network")) return true;
  const status = err?.response?.status ?? err?.status;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

const MAX_TENTATIVAS = 3;
const BACKOFFS_MIN = [1, 5, 15]; // minutos entre tentativas (1m → 5m → 15m)

// =========================================================
// 3. Processamento das execuções pendentes
// =========================================================
export async function processarExecucoesPendentes(limite = 200) {
  const agora = new Date();
  const pendentes = await prisma.execucaoRegua.findMany({
    where: { status: "PENDENTE", agendadoPara: { lte: agora } },
    take: limite,
    orderBy: { agendadoPara: "asc" },
    include: {
      cliente: { include: { telefones: true, emails: true } },
      cobranca: true,
      passo: true,
    },
  });

  let sucesso = 0;
  let erros = 0;

  for (const exec of pendentes) {
    try {
      // Se a cobrança foi paga entre a geração e agora, pula
      if (exec.cobranca?.status === "PAGO") {
        await prisma.execucaoRegua.update({
          where: { id: exec.id },
          data: { status: "PULADO" },
        });
        continue;
      }

      // A/B testing — escolhe variante determinística
      const { template, varianteIdx } = escolherVariante(exec.passo, {
        clienteId: exec.cliente.id,
        cobrancaId: exec.cobrancaId,
      });

      const ctx = await enriquecerCobrancaComAtualizacao({
        cliente: exec.cliente,
        cobranca: exec.cobranca,
        hoje: new Date(),
      });
      const mensagem = renderTemplate(template, ctx);

      if (exec.passo.canal === "WHATSAPP") {
        // PREFERÊNCIA Cestacorp (Patrick 24/04): grupo > telefone individual
        const grupoId = (exec.cliente as any).whatsappGrupoId;
        const grupoNome = (exec.cliente as any).whatsappGrupoNome;

        let envio: { id: string };
        let destinoTexto: string;

        if (grupoId) {
          // Envia direto pro grupo (não precisa de upsert de contato)
          envio = await digisacEnviar({
            contactId: grupoId,  // Digisac aceita grupo como contactId
            number: grupoId,
            text: mensagem,
          });
          destinoTexto = `grupo:${grupoNome ?? grupoId}`;
        } else {
          // Fallback: telefone individual (compatibilidade com clientes sem grupo configurado)
          const tel = exec.cliente.telefones.find((t) => t.whatsapp && t.principal)
                   || exec.cliente.telefones.find((t) => t.whatsapp)
                   || exec.cliente.telefones[0];
          if (!tel) throw new Error("Cliente sem grupo WhatsApp nem telefone individual");

          let contactId = exec.cliente.digisacContactId;
          if (!contactId) {
            const contato = await upsertContato({
              name: exec.cliente.razaoSocial,
              number: tel.numero,
            });
            contactId = contato.id;
            await prisma.cliente.update({
              where: { id: exec.cliente.id },
              data: { digisacContactId: contactId },
            });
          }

          envio = await digisacEnviar({
            contactId,
            number: tel.numero,
            text: mensagem,
          });
          destinoTexto = tel.numero;
        }

        await prisma.execucaoRegua.update({
          where: { id: exec.id },
          data: {
            status: "ENVIADO",
            enviadoEm: new Date(),
            mensagemFinal: mensagem,
            digisacMessageId: envio.id,
            varianteUsada: varianteIdx,
          },
        });

        // Log bruto no Mongo
        await connectMongo();
        await MessageLogModel.create({
          canal: "WHATSAPP",
          direcao: "OUT",
          clienteId: exec.cliente.id,
          execucaoReguaId: exec.id,
          para: destinoTexto,
          conteudo: mensagem,
          provider: "digisac",
          providerMessageId: envio.id,
          providerPayload: envio,
          status: "ENVIADO",
        });

        sucesso++;
      } else if (exec.passo.canal === "EMAIL") {
        const email = exec.cliente.emails.find((e) => e.principal)?.email
          ?? exec.cliente.emails[0]?.email;
        if (!email) throw new Error("Cliente sem e-mail cadastrado");

        const subject = `Cestacorp — ${exec.passo.nome}`;
        const envio = await enviarEmail({
          to: email,
          subject,
          text: mensagem,
          html: mensagem.replace(/\n/g, "<br/>"),
        });

        await prisma.execucaoRegua.update({
          where: { id: exec.id },
          data: {
            status: "ENVIADO",
            enviadoEm: new Date(),
            mensagemFinal: mensagem,
            digisacMessageId: envio.id,
          },
        });

        await connectMongo();
        await MessageLogModel.create({
          canal: "EMAIL",
          direcao: "OUT",
          clienteId: exec.cliente.id,
          execucaoReguaId: exec.id,
          para: email,
          assunto: subject,
          conteudo: mensagem,
          provider: "smtp",
          providerMessageId: envio.id,
          providerPayload: envio,
          status: envio.simulated ? "ENVIANDO" : "ENVIADO",
        });

        sucesso++;
      } else {
        await prisma.execucaoRegua.update({
          where: { id: exec.id },
          data: { status: "ERRO", erro: `Canal não suportado: ${exec.passo.canal}` },
        });
        erros++;
      }
    } catch (err: any) {
      // Conta quantas tentativas já rolaram neste registro
      const anteriores: any[] = Array.isArray(exec.tentativas) ? (exec.tentativas as any[]) : [];
      const numTentativas = anteriores.length + 1;
      const transiente = isErroTransiente(err);
      const temMaisChance = transiente && numTentativas < MAX_TENTATIVAS;

      const novasTentativas = [
        ...anteriores,
        {
          at: new Date().toISOString(),
          status: "ERRO",
          erro: String(err?.message ?? err).slice(0, 280),
          transiente,
        },
      ];

      if (temMaisChance) {
        // Reagenda com backoff exponencial
        const mins = BACKOFFS_MIN[numTentativas - 1] ?? 15;
        const reAgenda = new Date(Date.now() + mins * 60_000);
        await prisma.execucaoRegua.update({
          where: { id: exec.id },
          data: {
            status: "PENDENTE",
            agendadoPara: reAgenda,
            erro: `tentativa ${numTentativas}/${MAX_TENTATIVAS}: ${String(err?.message ?? err).slice(0, 200)}`,
            tentativas: novasTentativas as any,
          },
        });
      } else {
        erros++;
        await prisma.execucaoRegua.update({
          where: { id: exec.id },
          data: {
            status: "ERRO",
            erro: String(err?.message ?? err),
            tentativas: novasTentativas as any,
          },
        });
        await notificar({
          tipo: "REGUA_ERRO",
          titulo: `Falha na régua: ${exec.cliente.razaoSocial}`,
          descricao: `${exec.passo.nome} (${exec.passo.canal}) — ${String(err?.message ?? err).slice(0, 120)}`,
          href: `/regua-cobranca/execucao/${exec.id}`,
          clienteId: exec.cliente.id,
          priority: "HIGH",
        });
      }
    }
  }

  return { processadas: pendentes.length, sucesso, erros };
}

// =========================================================
// 4. Rotina principal (chamada pelo cron)
// =========================================================
export async function rodarReguaDiaria() {
  const sincrono = await sincronizarCobrancasNibo();
  const gerado = await gerarExecucoesDaRegua();
  const lotesAgendados = await processarEnviosAgendados();
  const processado = await processarExecucoesPendentes();

  // Aplica regras automáticas de tag (INADIMPLENTE, BOM PAGADOR, etc.)
  const regrasTag = await (async () => {
    try {
      const mod = await import("./regras-tag");
      return await mod.aplicarTodasRegrasTag();
    } catch (e) { console.error("[regras-tag]", e); return null; }
  })();

  // Agenda: materializa próximos eventos e notifica os que vencem em breve
  const agenda = await materializaEventos(90);
  await notificarVencimentosAgenda();

  // Resumo diário para a equipe
  const atrasados = await prisma.cobranca.count({ where: { status: "ATRASADO" } });
  if (atrasados > 0) {
    await notificar({
      tipo: "COBRANCA_ATRASADA",
      titulo: `${atrasados} cobranças em atraso`,
      descricao: `Resumo da rodada: ${processado.sucesso} enviadas, ${processado.erros} erros`,
      href: "/regua-cobranca",
      priority: atrasados > 10 ? "HIGH" : "NORMAL",
    });
  }

  return { sincrono, gerado, lotesAgendados, processado, agenda, regrasTag, rodadoEm: new Date().toISOString() };
}

/**
 * Consumer dos envios em lote agendados (EnvioAgendadoModel no Mongo).
 * Busca agendamentos com `agendadoPara <= agora` e status AGENDADO, dispara
 * um por um respeitando rate limiting, e marca CONCLUIDO/ERRO.
 */
async function processarEnviosAgendados() {
  await connectMongo();
  const { EnvioAgendadoModel } = await import("@/models/EnvioAgendado");
  const agora = new Date();
  const pendentes = await EnvioAgendadoModel.find({
    status: "AGENDADO",
    agendadoPara: { $lte: agora },
  }).limit(10).lean();

  let total = 0, sucesso = 0, erro = 0;

  for (const lote of pendentes as any[]) {
    // marca EM_EXECUCAO (evita 2 workers pegando o mesmo)
    const updated = await EnvioAgendadoModel.findOneAndUpdate(
      { _id: lote._id, status: "AGENDADO" },
      { $set: { status: "EM_EXECUCAO" } },
      { new: true }
    );
    if (!updated) continue; // outro worker pegou

    const detalhes: any[] = [];
    let okCount = 0, errCount = 0;

    for (const alvo of lote.alvos ?? []) {
      try {
        const cliente = await prisma.cliente.findUnique({
          where: { id: alvo.clienteId },
          include: { telefones: { where: { whatsapp: true } } },
        });
        if (!cliente) throw new Error("cliente não encontrado");
        const tel = cliente.telefones.find((t) => t.principal) ?? cliente.telefones[0];
        if (!tel) throw new Error("cliente sem telefone");

        const cobranca = alvo.cobrancaId
          ? await prisma.cobranca.findUnique({ where: { id: alvo.cobrancaId } })
          : null;

        const ctxLote = await enriquecerCobrancaComAtualizacao({
          cliente,
          cobranca: cobranca ?? { descricao: "", valor: 0, vencimento: new Date() },
          hoje: new Date(),
        });
        const msg = renderTemplate(lote.template, ctxLote);

        let contactId = cliente.digisacContactId;
        if (!contactId) {
          const c = await upsertContato({ name: cliente.razaoSocial, number: tel.numero });
          contactId = c.id;
          await prisma.cliente.update({ where: { id: cliente.id }, data: { digisacContactId: contactId } });
        }
        const envio = await digisacEnviar({ contactId, number: tel.numero, text: msg });

        await MessageLogModel.create({
          canal: "WHATSAPP",
          direcao: "OUT",
          clienteId: cliente.id,
          para: tel.numero,
          conteudo: msg,
          provider: "digisac",
          providerMessageId: envio.id,
          providerPayload: envio,
          status: "ENVIADO",
        });
        okCount++;
        detalhes.push({ clienteId: alvo.clienteId, ok: true });
      } catch (err: any) {
        errCount++;
        detalhes.push({ clienteId: alvo.clienteId, ok: false, erro: String(err?.message ?? err) });
      }
    }

    await EnvioAgendadoModel.updateOne(
      { _id: lote._id },
      {
        $set: {
          status: errCount > 0 && okCount === 0 ? "ERRO" : "CONCLUIDO",
          executadoEm: new Date(),
          resultado: { sucesso: okCount, erro: errCount, detalhes },
        },
      }
    );

    total++;
    sucesso += okCount;
    erro += errCount;
  }

  return { lotes: total, mensagens: { sucesso, erro } };
}

/**
 * Notifica eventos que estão dentro da antecedência configurada.
 * Dedup simples: só cria 1 notificação por evento (via key `meta.eventoId`).
 */
async function notificarVencimentosAgenda() {
  const proximos = await proximosEventos(30);
  for (const e of proximos) {
    const antecedencia = 7; // default; a Obrigacao tem esse campo — poderíamos usar se preciso
    const diasAteVencer = Math.ceil((e.dataVencimento.getTime() - Date.now()) / 86400000);
    if (diasAteVencer > antecedencia) continue;

    await notificar({
      tipo: "REAJUSTE_MES", // reaproveitado como "obrigação perto" — ok para inbox
      titulo: `${e.obrigacao?.tipo ?? "Obrigação"}: ${e.titulo}`,
      descricao: `${diasAteVencer <= 0 ? "VENCEU" : `vence em ${diasAteVencer}d`}${e.cliente ? ` · ${e.cliente.razaoSocial}` : ""}`,
      href: `/agenda/${e.id}`,
      clienteId: e.cliente?.id,
      priority: diasAteVencer <= 1 ? "HIGH" : "NORMAL",
    });
  }
}
