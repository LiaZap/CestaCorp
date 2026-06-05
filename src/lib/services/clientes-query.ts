/**
 * Query builder do filtro multi-coluna de /clientes (issue #4 — call 18/05).
 * Centraliza no service pra ser reusado pela page server e pelo /api/clientes/export (CSV).
 */
import type { Prisma } from "@prisma/client";

export interface ClientesQuery {
  q?: string;
  tributacao?: string;
  status?: string;
  classificacao?: string;
  seguimento?: string;
  categoria?: string;
  prefeitura?: string;
  folha?: string;
  sedeVirtual?: string; // "sim" | "nao"
  avaliacaoGoogle?: string; // "sim" | "nao"
  respFiscal?: string;
  respFolha?: string;
  respContabil?: string;
  tag?: string;
  // Drill-down from dashboard (movimentação clicável — call 18/05 #5)
  inicioDe?: string; // YYYY-MM-DD
  inicioAte?: string;
  atrasados?: string; // "1" => só clientes com cobranças atrasadas
}

const STATUS_VALIDOS = new Set(["ATIVO", "INATIVO", "ENCERRADO", "PROSPECT", "SUSPENSO"]);

/**
 * Monta o WHERE do Prisma a partir dos searchParams.
 * Todos os filtros viram AND — o usuário enxerga conjunção.
 */
export async function buildClientesWhere(q: ClientesQuery): Promise<Prisma.ClienteWhereInput> {
  const and: Prisma.ClienteWhereInput[] = [];

  if (q.q?.trim()) {
    const term = q.q.trim();
    and.push({
      OR: [
        { razaoSocial: { contains: term, mode: "insensitive" } },
        { nomeFantasia: { contains: term, mode: "insensitive" } },
        { cpfCnpj: { contains: term } },
      ],
    });
  }

  if (q.status && STATUS_VALIDOS.has(q.status)) {
    and.push({ status: q.status as any });
  }
  if (q.tributacao) and.push({ tributacao: q.tributacao });
  if (q.classificacao) and.push({ classificacao: q.classificacao as any });
  if (q.seguimento) and.push({ seguimento: { contains: q.seguimento, mode: "insensitive" } });
  if (q.categoria) and.push({ categoria: { contains: q.categoria, mode: "insensitive" } });
  if (q.prefeitura) and.push({ prefeitura: q.prefeitura });
  if (q.folha) and.push({ folha: q.folha });
  if (q.sedeVirtual === "sim") and.push({ sedeVirtual: true });
  if (q.sedeVirtual === "nao") and.push({ sedeVirtual: false });
  if (q.avaliacaoGoogle === "sim") and.push({ avaliacaoGoogle: true });
  if (q.avaliacaoGoogle === "nao") and.push({ avaliacaoGoogle: false });
  if (q.respFiscal) and.push({ respFiscal: q.respFiscal });
  if (q.respFolha) and.push({ respFolha: q.respFolha });
  if (q.respContabil) and.push({ respContabil: q.respContabil });
  if (q.tag) and.push({ tags: { some: { tagId: q.tag } } });

  // Movimentação clicável: cards de entradas → /clientes?inicioDe=...&inicioAte=...
  if (q.inicioDe || q.inicioAte) {
    const inicio: any = {};
    if (q.inicioDe) {
      const d = new Date(q.inicioDe);
      if (!isNaN(d.getTime())) inicio.gte = d;
    }
    if (q.inicioAte) {
      const d = new Date(q.inicioAte);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        inicio.lte = d;
      }
    }
    if (Object.keys(inicio).length > 0) and.push({ inicio });
  }

  if (q.atrasados === "1") {
    and.push({ cobrancas: { some: { status: "ATRASADO" } } });
  }

  return and.length > 0 ? { AND: and } : {};
}
