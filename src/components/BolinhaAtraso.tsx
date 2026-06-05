/**
 * Marca visual de cliente inadimplente.
 *
 * Patrick (call 18/05): "ele tem que primeiro passar no financeiro pra ser
 * cobrado, porque se tá com a bolinha vermelha significa que tá mais de três
 * mensalidades em atraso".
 *
 * Cores por nível:
 *  - 1 cobrança em atraso → amarelo (atenção)
 *  - 2 cobranças → laranja
 *  - 3+ cobranças → VERMELHO (bloqueio operacional)
 *
 * Visualmente é um ponto + tooltip nativo (title) com a quantidade.
 */

interface Props {
  qtd: number;
  /** Tamanho em px (default 8 = w-2 h-2). */
  size?: 6 | 8 | 10 | 12;
  /** Mostrar texto "X em atraso" ao lado. */
  comLabel?: boolean;
  className?: string;
}

export function BolinhaAtraso({ qtd, size = 8, comLabel = false, className = "" }: Props) {
  if (qtd <= 0) return null;

  const cor =
    qtd >= 3 ? "bg-red-500 ring-red-200" :
    qtd === 2 ? "bg-orange-500 ring-orange-200" :
    "bg-amber-400 ring-amber-200";

  const sizeCls = {
    6: "h-1.5 w-1.5",
    8: "h-2 w-2",
    10: "h-2.5 w-2.5",
    12: "h-3 w-3",
  }[size];

  const title =
    qtd >= 3
      ? `${qtd} cobranças em atraso — bloqueio financeiro recomendado`
      : `${qtd} cobrança${qtd > 1 ? "s" : ""} em atraso`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      title={title}
      aria-label={title}
    >
      <span
        className={`inline-block ${sizeCls} rounded-full ring-2 ${cor} ${qtd >= 3 ? "animate-pulse" : ""}`}
      />
      {comLabel && (
        <span className={`text-xs font-medium ${qtd >= 3 ? "text-red-700" : qtd === 2 ? "text-orange-700" : "text-amber-700"}`}>
          {qtd} em atraso
        </span>
      )}
    </span>
  );
}

/**
 * Banner pra ficha do cliente quando está em atraso pesado (3+).
 * Patrick: "primeiro passar no financeiro pra ser cobrado antes de operação".
 */
export function BannerInadimplencia({
  qtd,
  valorAtrasado,
}: {
  qtd: number;
  valorAtrasado?: number;
}) {
  if (qtd < 3) return null;

  return (
    <div
      role="alert"
      className="border-l-4 border-red-500 bg-red-50/80 px-4 py-3 rounded-md flex items-start gap-3"
    >
      <span className="inline-block h-3 w-3 rounded-full bg-red-500 ring-2 ring-red-200 mt-1 animate-pulse" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-red-900">
          Cliente com {qtd} cobranças em atraso
        </p>
        <p className="text-sm text-red-800/90 mt-0.5">
          Direcionar para o financeiro antes de qualquer atendimento operacional.
          {valorAtrasado != null && valorAtrasado > 0 && (
            <> Valor consolidado em aberto: <b className="font-mono">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorAtrasado)}</b>.</>
          )}
        </p>
      </div>
    </div>
  );
}
