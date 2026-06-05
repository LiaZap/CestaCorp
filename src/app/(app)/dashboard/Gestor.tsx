/**
 * Dashboard Gestor (call 18/05) — visão completa.
 * Sobrepõe Operacional + Financeiro + classificação.
 */
import Link from "next/link";
import { Users, AlertCircle, Send, CheckCircle2, FileText, TrendingDown, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KpiCard } from "@/components/KpiCard";
import { CobrancasTimeline } from "@/components/charts/CobrancasTimeline";
import { FormFunil } from "@/components/charts/FormFunil";
import { TopAtrasos } from "@/components/charts/TopAtrasos";
import { ClassificacaoPie } from "@/components/charts/ClassificacaoPie";
import { ReguaStatusChart } from "@/components/charts/ReguaStatusChart";
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
  funil: any[];
  topAtrasos: any[];
  classif: any[];
  reguaStatus: any[];
  proximas: any[];
  dias: number;
}

export function Gestor({ kpis, timeline, funil, topAtrasos, classif, reguaStatus, proximas, dias }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          label="Clientes ativos"
          value={kpis.clientesAtivos}
          sub={`de ${kpis.clientesTotal} no total`}
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
          label="Mensagens hoje"
          value={kpis.execucoesHoje}
          sub="enviadas pela régua"
          icon={Send}
          color="text-cestacorp-blue"
          href="/regua-cobranca"
        />
        <KpiCard
          label="Formulários no mês"
          value={kpis.respostasMes}
          sub="novas respostas"
          icon={FileText}
          color="text-purple-600"
          href="/formularios"
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Mensagens da Régua — últimos {dias} dias</CardTitle>
            <CardDescription>Volume diário por status</CardDescription>
          </CardHeader>
          <CardContent className="px-2 md:px-6">
            <ReguaStatusChart data={reguaStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <Link href="/formularios" className="hover:underline">
                Funil de formulários
              </Link>
            </CardTitle>
            <CardDescription>Status no total</CardDescription>
          </CardHeader>
          <CardContent className="px-2 md:px-6">
            <FormFunil data={funil} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card className="lg:col-span-2">
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
            <CardTitle>
              <Link href="/clientes?status=ATIVO" className="hover:underline">
                Classificação
              </Link>
            </CardTitle>
            <CardDescription>Clientes ativos</CardDescription>
          </CardHeader>
          <CardContent>
            <ClassificacaoPie data={classif} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" /> Próximas cobranças a vencer (7 dias)
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
  );
}
