/**
 * Serviço de agenda / obrigações fiscais.
 *
 * Uma Obrigacao é o "modelo" (DAS mensal, DEFIS anual, reunião mensal…).
 * EventoAgenda são as instâncias geradas nas datas certas.
 *
 * A rotina materializaEventos() roda dentro do cron diário e:
 *   1. Para cada Obrigacao ativa, calcula as próximas datas de vencimento
 *      dentro de uma janela (default 90 dias)
 *   2. Para Obrigacao global, gera 1 evento por cliente aplicável (respeita
 *      filtros por classificação/tributação)
 *   3. Atualiza eventos atrasados (vencimento passado + status PENDENTE)
 */

import { prisma } from "@/lib/db/prisma";
import { addDays, addMonths, setDate, startOfDay, isBefore, isAfter } from "date-fns";

const TZ = "America/Sao_Paulo";

// ================================================
// Cálculo de próximos vencimentos
// ================================================

export function proximosVencimentos(obrig: {
  recorrencia: string;
  diaVencimento: number | null;
  mesVencimento: number | null;
  diaVencimentoAnual: number | null;
  dataUnica: Date | null;
}, janelaDias = 90): Date[] {
  const hoje = startOfDay(new Date());
  const fim = addDays(hoje, janelaDias);
  const datas: Date[] = [];

  if (obrig.recorrencia === "UNICA" && obrig.dataUnica) {
    if (!isBefore(obrig.dataUnica, hoje)) datas.push(obrig.dataUnica);
  }

  if (obrig.recorrencia === "MENSAL" && obrig.diaVencimento) {
    // ~4 meses à frente
    for (let m = 0; m < Math.ceil(janelaDias / 28) + 1; m++) {
      const ref = addMonths(hoje, m);
      const data = setDate(ref, obrig.diaVencimento);
      if (isBefore(data, hoje)) continue;
      if (isAfter(data, fim)) break;
      datas.push(data);
    }
  }

  if (obrig.recorrencia === "ANUAL" && obrig.mesVencimento && obrig.diaVencimentoAnual) {
    for (let y = 0; y < 2; y++) {
      const ref = new Date(hoje.getFullYear() + y, obrig.mesVencimento - 1, obrig.diaVencimentoAnual);
      if (isBefore(ref, hoje)) continue;
      if (isAfter(ref, fim)) continue;
      datas.push(ref);
    }
  }

  if (obrig.recorrencia === "TRIMESTRAL" && obrig.diaVencimento) {
    for (let m = 0; m < 12; m += 3) {
      const ref = addMonths(hoje, m);
      const data = setDate(ref, obrig.diaVencimento);
      if (isBefore(data, hoje)) continue;
      if (isAfter(data, fim)) break;
      datas.push(data);
    }
  }

  return datas;
}

// ================================================
// Materializa eventos (job diário)
// ================================================
export async function materializaEventos(janelaDias = 90) {
  const hoje = startOfDay(new Date());
  const obrigacoes = await prisma.obrigacao.findMany({ where: { ativa: true } });

  let criados = 0;

  for (const o of obrigacoes) {
    const datas = proximosVencimentos(o as any, janelaDias);
    if (datas.length === 0) continue;

    // resolve clientes alvo
    let clientesAlvo: { id: string }[] = [];
    if (o.global) {
      // Filtro principal por status, classificação e tributação
      const where: any = {
        status: "ATIVO",
        ...(o.categoriaCliente ? { classificacao: o.categoriaCliente } : {}),
        ...(o.tributacaoFiltro ? { tributacao: { contains: o.tributacaoFiltro, mode: "insensitive" } } : {}),
      };

      // Tags requeridas: cliente precisa ter TODAS
      const tagsReq = (o as any).tagsRequeridas as string[] | undefined;
      if (tagsReq && tagsReq.length > 0) {
        where.AND = tagsReq.map((slug) => ({
          tags: { some: { tag: { slug } } },
        }));
      }

      // Tags excluídas: cliente NÃO pode ter NENHUMA
      const tagsExcl = (o as any).tagsExcluidas as string[] | undefined;
      if (tagsExcl && tagsExcl.length > 0) {
        where.NOT = {
          tags: { some: { tag: { slug: { in: tagsExcl } } } },
        };
      }

      clientesAlvo = await prisma.cliente.findMany({ where, select: { id: true } });
    } else if (o.clienteId) {
      clientesAlvo = [{ id: o.clienteId }];
    } else {
      // obrigação interna sem cliente (ex.: reunião da equipe)
      clientesAlvo = [{ id: "__sem_cliente__" }];
    }

    for (const data of datas) {
      for (const c of clientesAlvo) {
        const clienteId = c.id === "__sem_cliente__" ? null : c.id;
        try {
          await prisma.eventoAgenda.upsert({
            where: {
              obrigacaoId_clienteId_dataVencimento: {
                obrigacaoId: o.id,
                clienteId: clienteId as any, // pode ser null
                dataVencimento: data,
              } as any,
            },
            update: {},
            create: {
              obrigacaoId: o.id,
              clienteId,
              titulo: o.nome,
              descricao: o.descricao,
              dataVencimento: data,
              responsavel: o.responsavel,
            },
          });
          criados++;
        } catch {
          // unique constraint — evento já existe, segue o baile
        }
      }
    }
  }

  // marca eventos vencidos como ATRASADO
  const atrasados = await prisma.eventoAgenda.updateMany({
    where: { status: "PENDENTE", dataVencimento: { lt: hoje } },
    data: { status: "ATRASADO" },
  });

  return { criados, marcadosAtrasados: atrasados.count };
}

// ================================================
// Listagens para a UI
// ================================================
export async function eventosDoMes(ano: number, mes: number) {
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 0, 23, 59, 59);
  return prisma.eventoAgenda.findMany({
    where: { dataVencimento: { gte: inicio, lte: fim } },
    orderBy: { dataVencimento: "asc" },
    include: {
      cliente: { select: { id: true, razaoSocial: true } },
      obrigacao: { select: { tipo: true, nome: true } },
    },
  });
}

export async function proximosEventos(dias = 30) {
  const hoje = startOfDay(new Date());
  const limite = addDays(hoje, dias);
  return prisma.eventoAgenda.findMany({
    where: {
      dataVencimento: { gte: hoje, lte: limite },
      status: { in: ["PENDENTE", "ATRASADO"] },
    },
    orderBy: { dataVencimento: "asc" },
    take: 50,
    include: {
      cliente: { select: { id: true, razaoSocial: true } },
      obrigacao: { select: { tipo: true, nome: true } },
    },
  });
}

export async function concluirEvento(id: string, userId: string, observacao?: string) {
  return prisma.eventoAgenda.update({
    where: { id },
    data: {
      status: "CONCLUIDO",
      concluidoEm: new Date(),
      concluidoPor: userId,
      observacao,
    },
  });
}
