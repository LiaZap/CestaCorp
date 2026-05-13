/**
 * Substitui placeholders {cliente.razaoSocial}, {cobranca.valor}, {vencimento.data}
 * em um template de texto. Usado nas mensagens da régua de cobrança.
 */

type Ctx = Record<string, any>;

function getByPath(obj: Ctx, path: string): any {
  return path.split(".").reduce<any>((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function fmtMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function fmtDate(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function renderTemplate(template: string, ctx: Ctx): string {
  return template.replace(/\{([^}]+)\}/g, (_, rawExpr) => {
    const [path, filter] = rawExpr.split("|").map((s: string) => s.trim());
    const raw = getByPath(ctx, path);
    if (raw == null) return "";
    if (filter === "money" && typeof raw === "number") return fmtMoney(raw);
    if (filter === "date") return fmtDate(raw);
    if (raw instanceof Date) return fmtDate(raw);
    return String(raw);
  });
}

export const PLACEHOLDERS_DISPONIVEIS = [
  "{cliente.razaoSocial}",
  "{cliente.nomeFantasia}",
  "{cliente.cpfCnpj}",
  "{cobranca.descricao}",
  "{cobranca.valor|money}",
  "{cobranca.vencimento|date}",
  "{cobranca.linhaDigitavel}",
  "{cobranca.urlBoleto}",
  "{cobranca.pixCopiaCola}",
  // Cálculo automático de atualização (Patrick 28/04: 1% juros + 2% multa)
  "{cobranca.valorAtualizado|money}",
  "{cobranca.juros|money}",
  "{cobranca.multa|money}",
  "{cobranca.diasAtraso}",
  "{hoje|date}",
];

/**
 * Enriquece o contexto da cobrança com valores atualizados (multa + juros).
 * Chame antes de `renderTemplate()` se a mensagem usa {cobranca.valorAtualizado}.
 *
 * Idempotente — se já tem valorAtualizado no objeto, não recalcula.
 */
export async function enriquecerCobrancaComAtualizacao(ctx: Ctx, hoje: Date = new Date()): Promise<Ctx> {
  if (!ctx.cobranca || ctx.cobranca.valorAtualizado != null) return ctx;
  const { calcularValorAtualizadoComSnapshot } = await import("./valor-atualizado");
  const valor = Number(ctx.cobranca.valor ?? 0);
  const venc = ctx.cobranca.vencimento instanceof Date
    ? ctx.cobranca.vencimento
    : new Date(ctx.cobranca.vencimento);
  // Patrick (09/05): snapshot da regra original — mudança de regra é prospectiva
  const r = await calcularValorAtualizadoComSnapshot(
    valor,
    venc,
    ctx.cobranca.regraJurosSnapshot,
    hoje,
  );
  return {
    ...ctx,
    cobranca: {
      ...ctx.cobranca,
      valorAtualizado: r.total,
      juros: r.juros,
      multa: r.multa,
      diasAtraso: r.diasAtraso,
    },
  };
}
