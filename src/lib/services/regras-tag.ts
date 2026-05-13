/**
 * Engine de regras automáticas de tags.
 * Roda no cron diário — avalia cada RegraTag ativa e aplica/remove a tag
 * nos clientes que batem na condição.
 *
 * Condições suportadas:
 *   - COBRANCA_ATRASADA_DIAS  { diasMinimos: N }
 *   - PAGO_MESES_SEGUIDOS     { meses: N }
 *   - SEM_COBRANCA_ABERTA
 *   - MES_ANIVERSARIO
 *   - TRIBUTACAO_CONTAINS     { texto: "Simples" }
 *   - CLASSIFICACAO           { valor: "OURO" }
 *   - STATUS                  { valor: "ATIVO" }
 */
import { prisma } from "@/lib/db/prisma";
import { subMonths, startOfMonth } from "date-fns";

export async function aplicarTodasRegrasTag(): Promise<{
  regras: number;
  aplicadas: number;
  removidas: number;
}> {
  const regras = await prisma.regraTag.findMany({
    where: { ativa: true },
    include: { tag: true },
  });

  let aplicadas = 0;
  let removidas = 0;

  for (const regra of regras) {
    try {
      const clientesIds = await clientesQueBatemCondicao(regra.condicao, regra.params as any);
      const conjunto = new Set(clientesIds);

      if (regra.acao === "APLICAR") {
        // Adiciona a tag para quem ainda não tem
        const jaTem = await prisma.clienteTag.findMany({
          where: { tagId: regra.tagId, clienteId: { in: clientesIds } },
          select: { clienteId: true },
        });
        const jaTemSet = new Set(jaTem.map((x) => x.clienteId));
        const novos = clientesIds.filter((id) => !jaTemSet.has(id));
        for (const id of novos) {
          await prisma.clienteTag.create({ data: { tagId: regra.tagId, clienteId: id } }).catch(() => {});
          aplicadas++;
        }
      } else {
        // REMOVER: tira a tag de quem bate a condição
        const r = await prisma.clienteTag.deleteMany({
          where: { tagId: regra.tagId, clienteId: { in: clientesIds } },
        });
        removidas += r.count;
      }

      await prisma.regraTag.update({
        where: { id: regra.id },
        data: {
          ultimaExecucao: new Date(),
          totalAplicacoes: { increment: conjunto.size },
        },
      });
    } catch (err) {
      console.error(`[regras-tag] erro na regra ${regra.id}:`, err);
    }
  }

  return { regras: regras.length, aplicadas, removidas };
}

async function clientesQueBatemCondicao(tipo: string, params: any): Promise<string[]> {
  switch (tipo) {
    case "COBRANCA_ATRASADA_DIAS": {
      const dias = Number(params?.diasMinimos ?? 7);
      const corte = new Date();
      corte.setDate(corte.getDate() - dias);
      const agg = await prisma.cobranca.findMany({
        where: { status: "ATRASADO", vencimento: { lte: corte } },
        select: { clienteId: true },
        distinct: ["clienteId"],
      });
      return agg.map((c) => c.clienteId);
    }
    case "PAGO_MESES_SEGUIDOS": {
      const meses = Number(params?.meses ?? 3);
      const desde = startOfMonth(subMonths(new Date(), meses));
      // Clientes que têm pagamentos nos últimos N meses e nenhum atraso no período
      const todos = await prisma.cliente.findMany({
        where: { status: "ATIVO" },
        select: {
          id: true,
          cobrancas: {
            where: { vencimento: { gte: desde } },
            select: { status: true, dataPagamento: true, vencimento: true },
          },
        },
      });
      return todos
        .filter((c) => {
          if (c.cobrancas.length < meses) return false;
          return c.cobrancas.every(
            (cb) => cb.status === "PAGO" && cb.dataPagamento && cb.dataPagamento <= new Date(cb.vencimento.getTime() + 86400_000)
          );
        })
        .map((c) => c.id);
    }
    case "SEM_COBRANCA_ABERTA": {
      const clientes = await prisma.cliente.findMany({
        where: { status: "ATIVO", cobrancas: { none: { status: { in: ["ABERTO", "ATRASADO"] } } } },
        select: { id: true },
      });
      return clientes.map((c) => c.id);
    }
    case "MES_ANIVERSARIO": {
      const mes = new Date().getMonth() + 1;
      const clientes = await prisma.cliente.findMany({
        where: { mesAniversarioReajuste: mes, status: "ATIVO" },
        select: { id: true },
      });
      return clientes.map((c) => c.id);
    }
    case "TRIBUTACAO_CONTAINS": {
      const texto = String(params?.texto ?? "");
      if (!texto) return [];
      const clientes = await prisma.cliente.findMany({
        where: { tributacao: { contains: texto, mode: "insensitive" } },
        select: { id: true },
      });
      return clientes.map((c) => c.id);
    }
    case "CLASSIFICACAO": {
      const valor = String(params?.valor ?? "");
      if (!valor) return [];
      const clientes = await prisma.cliente.findMany({
        where: { classificacao: valor as any },
        select: { id: true },
      });
      return clientes.map((c) => c.id);
    }
    case "STATUS": {
      const valor = String(params?.valor ?? "");
      if (!valor) return [];
      const clientes = await prisma.cliente.findMany({
        where: { status: valor as any },
        select: { id: true },
      });
      return clientes.map((c) => c.id);
    }
    default:
      return [];
  }
}

export const CONDICOES_METADATA = [
  { value: "COBRANCA_ATRASADA_DIAS", label: "Cobrança atrasada há X dias", exemploParams: { diasMinimos: 7 } },
  { value: "PAGO_MESES_SEGUIDOS", label: "Pagou em dia por X meses seguidos", exemploParams: { meses: 3 } },
  { value: "SEM_COBRANCA_ABERTA", label: "Sem cobranças em aberto/atrasadas", exemploParams: {} },
  { value: "MES_ANIVERSARIO", label: "Mês do aniversário do contrato", exemploParams: {} },
  { value: "TRIBUTACAO_CONTAINS", label: "Tributação contém texto", exemploParams: { texto: "Simples" } },
  { value: "CLASSIFICACAO", label: "Classificação igual a", exemploParams: { valor: "OURO" } },
  { value: "STATUS", label: "Status igual a", exemploParams: { valor: "ATIVO" } },
];
