import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, Users, ArrowRight } from "lucide-react";
import { BolinhaAtraso } from "@/components/BolinhaAtraso";
import { formatMoney } from "@/lib/utils";
import type { NivelInadimplencia } from "@/lib/services/inadimplencia";

/**
 * Painel "Inadimplência por nível" — Patrick (call 18/05):
 * "saber quais são os clientes com 1, 2, 3+ cobranças em atraso".
 *
 * Mostra 4 cards (em dia / 1 / 2 / 3+) cada um clicável → lista filtrada.
 * Card de 3+ destacado em vermelho (regra do bloqueio operacional).
 */

interface Props {
  distribuicao: {
    total: number;
    porNivel: Record<NivelInadimplencia, number>;
    totalInadimplentes: number;
    totalBolinhaVermelha: number;
  };
  topInadimplentes: Array<{
    clienteId: string;
    codigo: number | null;
    razaoSocial: string;
    nomeFantasia: string | null;
    qtdAtrasadas: number;
    valorAtrasado: number;
  }>;
}

export function InadimplenciaPanel({ distribuicao, topInadimplentes }: Props) {
  const { porNivel } = distribuicao;

  const niveis: Array<{
    titulo: string;
    qtd: number;
    cor: string;
    href: string;
    icone?: React.ReactNode;
  }> = [
    {
      titulo: "Em dia",
      qtd: porNivel.EM_DIA,
      cor: "border-emerald-300 bg-emerald-50/40 text-emerald-900",
      href: "/clientes?status=ATIVO",
    },
    {
      titulo: "1 em atraso",
      qtd: porNivel.UMA,
      cor: "border-amber-300 bg-amber-50/40 text-amber-900",
      href: "/cobrancas?status=ATRASADO&qtdMin=1&qtdMax=1",
      icone: <BolinhaAtraso qtd={1} />,
    },
    {
      titulo: "2 em atraso",
      qtd: porNivel.DUAS,
      cor: "border-orange-300 bg-orange-50/40 text-orange-900",
      href: "/cobrancas?status=ATRASADO&qtdMin=2&qtdMax=2",
      icone: <BolinhaAtraso qtd={2} />,
    },
    {
      titulo: "3+ em atraso",
      qtd: porNivel.TRES_OU_MAIS,
      cor: "border-red-400 bg-red-50/60 text-red-900 ring-2 ring-red-100",
      href: "/cobrancas?status=ATRASADO&qtdMin=3",
      icone: <BolinhaAtraso qtd={3} />,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Inadimplência por nível
            </CardTitle>
            <CardDescription>
              {distribuicao.totalInadimplentes} de {distribuicao.total} clientes ativos
              com pelo menos uma cobrança em atraso
              {distribuicao.totalBolinhaVermelha > 0 && (
                <> · <span className="text-red-700 font-medium">{distribuicao.totalBolinhaVermelha} em alerta vermelho</span></>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {niveis.map((n) => (
            <Link
              key={n.titulo}
              href={n.href}
              className={`group rounded-lg border-2 p-3 transition-all hover:shadow-md hover:-translate-y-0.5 ${n.cor}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold opacity-80">
                  {n.titulo}
                </span>
                {n.icone}
              </div>
              <p className="text-3xl font-bold tabular-nums mt-1">{n.qtd}</p>
              <p className="text-[10px] opacity-70 mt-0.5 flex items-center gap-1">
                clientes
                <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
              </p>
            </Link>
          ))}
        </div>

        {topInadimplentes.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                Top 10 clientes inadimplentes
              </p>
              <Link
                href="/cobrancas?status=ATRASADO"
                className="text-xs text-cestacorp-blue hover:underline flex items-center gap-0.5"
              >
                Ver todos <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <ul className="divide-y border rounded-md">
              {topInadimplentes.slice(0, 10).map((c) => (
                <li key={c.clienteId}>
                  <Link
                    href={`/clientes/${c.clienteId}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/40 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BolinhaAtraso qtd={c.qtdAtrasadas} size={10} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {c.codigo != null && (
                            <span className="text-muted-foreground mr-1">#{c.codigo}</span>
                          )}
                          {c.razaoSocial}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {c.qtdAtrasadas} cobrança{c.qtdAtrasadas > 1 ? "s" : ""} em atraso
                        </p>
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="text-sm font-semibold text-red-700">
                        {formatMoney(c.valorAtrasado)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">em aberto</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
