/**
 * Dashboard Financeiro (call 18/05) — foco em R$:
 *   - inadimplência, projeção, recebimento
 *   - top inadimplentes
 *   - cobranças por mês
 * Sem operação (régua/forms ficam secundários).
 */
import Link from "next/link";
import { Users, AlertCircle, CheckCircle2, TrendingDown, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KpiCard } from "@/components/KpiCard";
import { CobrancasTimeline } from "@/components/charts/CobrancasTimeline";
import { TopAtrasos } from "@/components/charts/TopAtrasos";
import { formatDate, formatMoney } from "@/lib/utils";

interface Props {
  kpis: {
    clientesAtivos: number;
    clientesTotal: number;
    cobrancasAbertas: number;
    valorEmAberto: number;
    valorAtrasado: number;
    pagoNoMes: number;
    execucoesHoje: number;
    respostasMes: number;
  };
  timeline: any[];
  topAtrasos: any[];
  proximas: any[];
  dias: number;
}

export function Financeiro({ kpis, timeline, topAtrasos, proximas, dias }: Props) {
  const projecaoMes = kpis.pagoNoMes + kpis.valorEmAberto;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          label="Clientes ativos"
          value={kpis.clientesAtivos}
          sub={`de ${kpis.clientesTotal}`}
          icon={Users}
          color="text-cestacorp-blue"
          href="/clientes?status=ATIVO"
        />
        <KpiCard
          label="Em aberto"
          value={formatMoney(kpis.valorEmAberto)}
          sub={`${kpis.cobrancasAbertas} cobranças`}
          icon={AlertCircle}
          color="text-amber-600"
          href="/cobrancas?status=ABERTO"
        />
        <KpiCard
          label="Em atraso"
          value={formatMoney(kpis.valorAtrasado)}
          sub="soma das atrasadas"
          icon={TrendingDown}
          color="text-red-600"
          href="/cobrancas?status=ATRASADO"
        />
        <KpiCard
          label="Pago no mês"
          value={formatMoney(kpis.pagoNoMes)}
          sub="recebido até agora"
          icon={CheckCircle2}
          color="text-cestacorp-green"
          href="/cobrancas?status=PAGO"
        />
        <KpiCard
          label="Projeção do mês"
          value={formatMoney(projecaoMes)}
          sub="recebido + em aberto"
          icon={CheckCircle2}
          color="text-cestacorp-blue"
          href="/cobrancas"
        />
        <KpiCard
          label="Inadimplentes"
          value={topAtrasos.length}
          sub="top 10 visível abaixo"
          icon={AlertCircle}
          color="text-red-600"
          href="/clientes?status=ATIVO&atrasados=1"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <Link href="/cobrancas" className="hover:underline">
              Cobranças nos últimos {Math.max(1, Math.ceil(dias / 30))} meses
            </Link>
          </CardTitle>
          <CardDescription>Emitido vs. pago vs. em atraso (R$)</CardDescription>
        </CardHeader>
        <CardContent className="px-2 md:px-6">
          <CobrancasTimeline data={timeline} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card>
          <CardHeader>
            <CardTitle>
              <Link href="/cobrancas?status=ATRASADO" className="hover:underline">
                Top 10 — clientes em atraso
              </Link>
            </CardTitle>
            <CardDescription>Ordenado por valor atualizado</CardDescription>
          </CardHeader>
          <CardContent>
            <TopAtrasos data={topAtrasos} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" /> Próximas cobranças (7 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {proximas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada vencendo nos próximos 7 dias.</p>
            ) : (
              <ul className="divide-y">
                {proximas.map((c: any) => (
                  <li key={c.id} className="py-2 flex items-center justify-between">
                    <div>
                      <Link href={`/clientes/${c.cliente.id}`} className="font-medium hover:underline">
                        {c.cliente.razaoSocial}
                      </Link>
                      <p className="text-xs text-muted-foreground">{c.descricao ?? "—"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatMoney(Number(c.valor))}</p>
                      <p className="text-xs text-muted-foreground">Vence {formatDate(c.vencimento)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
