/**
 * Timeline unificada por cliente.
 * Mescla eventos de diferentes fontes (Postgres + Mongo) e ordena por data decrescente.
 */
import { prisma } from "@/lib/db/prisma";
import { connectMongo } from "@/lib/db/mongo";
import { FormResponseModel } from "@/models/FormResponse";
import { MessageLogModel } from "@/models/MessageLog";

export type TimelineEvent = {
  id: string;
  tipo:
    | "contrato_emitido"
    | "cobranca_emitida"
    | "cobranca_paga"
    | "cobranca_atrasada"
    | "mensagem_enviada"
    | "mensagem_recebida"
    | "execucao_regua"
    | "form_respondido"
    | "observacao"
    | "cliente_criado";
  data: Date;
  titulo: string;
  descricao?: string;
  href?: string;
  autor?: string;
  meta?: Record<string, any>;
};

export async function getTimeline(clienteId: string, limit = 60): Promise<TimelineEvent[]> {
  const [cliente, contratos, cobrancas, execucoes, observacoes] = await Promise.all([
    prisma.cliente.findUnique({
      where: { id: clienteId },
      select: { id: true, razaoSocial: true, createdAt: true },
    }),
    prisma.contrato.findMany({
      where: { clienteId },
      orderBy: { createdAt: "desc" },
      include: { template: { select: { nome: true } } },
    }),
    prisma.cobranca.findMany({
      where: { clienteId },
      orderBy: { vencimento: "desc" },
    }),
    prisma.execucaoRegua.findMany({
      where: { clienteId },
      orderBy: { agendadoPara: "desc" },
      take: 40,
      include: { passo: { select: { nome: true, canal: true } } },
    }),
    prisma.clienteObservacao.findMany({
      where: { clienteId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!cliente) return [];

  await connectMongo();
  const [forms, logs] = await Promise.all([
    FormResponseModel.find({ clienteId }).sort({ createdAt: -1 }).limit(40).lean(),
    MessageLogModel.find({ clienteId }).sort({ createdAt: -1 }).limit(40).lean(),
  ]);

  const eventos: TimelineEvent[] = [];

  eventos.push({
    id: `cliente-${cliente.id}`,
    tipo: "cliente_criado",
    data: cliente.createdAt,
    titulo: "Cliente cadastrado",
    descricao: cliente.razaoSocial,
  });

  for (const c of contratos) {
    eventos.push({
      id: `ctr-${c.id}`,
      tipo: "contrato_emitido",
      data: c.createdAt,
      titulo: `Contrato ${c.numero ?? c.id.slice(0, 6)} emitido`,
      descricao: c.template?.nome ? `Template: ${c.template.nome}` : c.tipo,
      meta: { valor: Number(c.valorHonorarios), status: c.status },
    });
  }

  for (const c of cobrancas) {
    if (c.status === "PAGO" && c.dataPagamento) {
      eventos.push({
        id: `cob-pago-${c.id}`,
        tipo: "cobranca_paga",
        data: c.dataPagamento,
        titulo: `Pagamento recebido`,
        descricao: c.descricao ?? undefined,
        href: `/cobrancas/${c.id}`,
        meta: { valor: Number(c.valor) },
      });
    }
    eventos.push({
      id: `cob-emit-${c.id}`,
      tipo: c.status === "ATRASADO" ? "cobranca_atrasada" : "cobranca_emitida",
      data: c.vencimento,
      titulo: c.status === "ATRASADO" ? `Cobrança em atraso` : `Cobrança com vencimento`,
      descricao: c.descricao ?? undefined,
      href: `/cobrancas/${c.id}`,
      meta: { valor: Number(c.valor), status: c.status },
    });
  }

  for (const e of execucoes) {
    if (e.enviadoEm) {
      eventos.push({
        id: `exec-${e.id}`,
        tipo: "execucao_regua",
        data: e.enviadoEm,
        titulo: `Régua: ${e.passo.nome}`,
        descricao: `Canal ${e.passo.canal} · ${e.status}`,
        href: `/regua-cobranca/execucao/${e.id}`,
      });
    }
  }

  for (const o of observacoes) {
    eventos.push({
      id: `obs-${o.id}`,
      tipo: "observacao",
      data: o.createdAt,
      titulo: "Observação",
      descricao: o.conteudo,
      autor: o.autor,
    });
  }

  for (const f of forms as any[]) {
    eventos.push({
      id: `form-${String(f._id)}`,
      tipo: "form_respondido",
      data: new Date(f.googleTimestamp ?? f.createdAt),
      titulo: `Formulário: ${f.formSlug}`,
      descricao: `Por ${f.autor?.nome ?? "—"}${f.origem === "import-google" ? " (Google Forms)" : ""}`,
      href: `/formularios/${f._id}`,
      meta: { status: f.status },
    });
  }

  for (const l of logs as any[]) {
    if (!l.conteudo) continue;
    eventos.push({
      id: `msg-${String(l._id)}`,
      tipo: l.direcao === "OUT" ? "mensagem_enviada" : "mensagem_recebida",
      data: new Date(l.createdAt),
      titulo: l.direcao === "OUT" ? `Mensagem enviada (${l.canal})` : `Mensagem recebida (${l.canal})`,
      descricao: String(l.conteudo).slice(0, 160),
      meta: { status: l.status },
    });
  }

  eventos.sort((a, b) => b.data.getTime() - a.data.getTime());
  return eventos.slice(0, limit);
}

export async function adicionarObservacao(clienteId: string, autor: string, conteudo: string) {
  return prisma.clienteObservacao.create({
    data: { clienteId, autor, conteudo },
  });
}
