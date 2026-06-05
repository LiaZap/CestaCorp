"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Copy, Check, Calculator } from "lucide-react";
import { formatMoney } from "@/lib/utils";

/**
 * Card destacado de "valor consolidado em aberto" pra ficha do cliente.
 *
 * Patrick (call 18/05): "tem cliente que tá com 4 mensalidades em aberto e
 * o valor atualizado pra pagamento hoje é tanto. Eu vou fazer um pix manual".
 *
 * Mostra:
 *  - quantidade de mensalidades em aberto
 *  - total bruto (soma direto)
 *  - total atualizado (soma com juros + multa)
 *  - diferença
 *  - botões Copy individuais
 */

interface Props {
  qtdMensalidades: number;
  totalBruto: number;
  totalAtualizado: number;
  diasAtrasoMaximo?: number;
}

export function CardValorConsolidado({
  qtdMensalidades,
  totalBruto,
  totalAtualizado,
  diasAtrasoMaximo,
}: Props) {
  const [copiado, setCopiado] = useState<string | null>(null);

  if (qtdMensalidades === 0) return null;

  const diff = totalAtualizado - totalBruto;
  const temAtraso = diff > 0.01;

  function copiar(label: string, valor: number) {
    const str = valor.toFixed(2).replace(".", ",");
    navigator.clipboard.writeText(str).then(() => {
      setCopiado(label);
      setTimeout(() => setCopiado(null), 1500);
    });
  }

  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50/60 to-white">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-amber-900 font-semibold flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5" />
              Valor consolidado em aberto
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {qtdMensalidades} {qtdMensalidades === 1 ? "mensalidade" : "mensalidades"}
              {temAtraso && diasAtrasoMaximo != null && diasAtrasoMaximo > 0 && (
                <> · até {diasAtrasoMaximo} dia{diasAtrasoMaximo > 1 ? "s" : ""} de atraso</>
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ValorCelula
            rotulo="Bruto"
            valor={totalBruto}
            destaque={false}
            copiado={copiado === "bruto"}
            onCopy={() => copiar("bruto", totalBruto)}
          />
          {temAtraso && (
            <ValorCelula
              rotulo="Juros + multa"
              valor={diff}
              destaque={false}
              ehIncremento
              copiado={copiado === "juros"}
              onCopy={() => copiar("juros", diff)}
            />
          )}
          <ValorCelula
            rotulo={temAtraso ? "Pagaria hoje" : "Total"}
            valor={totalAtualizado}
            destaque
            copiado={copiado === "total"}
            onCopy={() => copiar("total", totalAtualizado)}
          />
        </div>

        <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
          Use o valor "Pagaria hoje" pra gerar um PIX manual. Clique no ícone pra copiar.
          {!temAtraso && " Nenhuma cobrança em atraso atualmente."}
        </p>
      </CardContent>
    </Card>
  );
}

function ValorCelula({
  rotulo,
  valor,
  destaque,
  ehIncremento = false,
  copiado,
  onCopy,
}: {
  rotulo: string;
  valor: number;
  destaque: boolean;
  ehIncremento?: boolean;
  copiado: boolean;
  onCopy: () => void;
}) {
  return (
    <div
      className={
        destaque
          ? "border-l-4 border-cestacorp-blue pl-3 bg-white/60 rounded-r-md py-2"
          : "py-2"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{rotulo}</p>
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copiar ${rotulo}`}
          className="text-muted-foreground hover:text-cestacorp-blue transition-colors"
        >
          {copiado ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <p
        className={
          "tabular-nums font-bold " +
          (destaque
            ? "text-2xl text-cestacorp-blue"
            : ehIncremento
              ? "text-lg text-amber-700"
              : "text-lg text-slate-700")
        }
      >
        {ehIncremento ? "+ " : ""}
        {formatMoney(valor)}
      </p>
    </div>
  );
}
