import Link from "next/link";
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, AlertCircle, Send, CheckCircle2, FileText, TrendingDown, CalendarClock } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/utils";
import {
  getKpis, getCobrancasTimeline, getFormsFunil,
  getTopAtrasos, getClassificacaoBreakdown, getReguaStatus,
  getProximasCobrancas,
} from "@/lib/services/dashboard-metrics";
import { CobrancasTimeline } from "@/components/charts/CobrancasTimeline";
import { FormFunil } from "@/components/charts/FormFunil";
import { TopAtrasos } from "@/components/charts/TopAtrasos";
import { ClassificacaoPie } from "@/components/charts/ClassificacaoPie";
import { ReguaStatusChart } from "@/components/charts/ReguaStatusChart";
import { QuickActions } from "@/components/QuickActions";
import { PeriodoSelector } from "./PeriodoSelector";

export const dynamic = "force-dynamic";

const PERIODOS_VALIDOS = [7, 14, 30, 60, 90, 180, 365] as const;
type PeriodoDias = typeof PERIODOS_VALIDOS[number];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { dias?: string };
}) {
  // Valida o período (default 30 dias)
  const diasRaw = Number(searchParams.dias ?? 30);
  const dias = (PERIODOS_VALIDOS.includes(diasRaw as any) ? diasRaw : 30) as PeriodoDias;
  const meses = Math.max(1, Math.ceil(dias / 30));

  const [session, kpis, timeline, funil, topAtrasos, classif, reguaStatus, proximas] = await Promise.all([
    auth(),
    getKpis(),
    getCobrancasTimeline(meses),
    getFormsFunil(),
    getTopAtrasos(10),
    getClassificacaoBreakdown(),
    getReguaStatus(dias),
    getProximasCobrancas(7, 8),
  ]);

  // Alerta no topo caso o perfil esteja incompleto (#82) — sem `name` o
  // /minha-semana fica inutilizável e os filtros por responsável quebram.
  const nomePerfil = (session?.user?.name ?? "").trim();

  const cardsKpi = [
    { label: "Clientes ativos", value: kpis.clientesAtivos, sub: `de ${kpis.clientesTotal} no total`, icon: Users, color: "text-cestacorp-blue" },
    { label: "Em aberto", value: formatMoney(kpis.valorEmAberto), sub: `${kpis.cobrancasAbertas} cobranças`, icon: AlertCircle, color: "text-amber-600" },
    { label: "Em atraso", value: formatMoney(kpis.valorAtrasado), sub: "soma das atrasadas", icon: TrendingDown, color: "text-red-600" },
    { label: "Pago no mês", value: formatMoney(kpis.pagoNoMes), sub: "recebido até agora", icon: CheckCircle2, color: "text-cestacorp-green" },
    { label: "Mensagens hoje", value: kpis.execucoesHoje, sub: "enviadas pela régua", icon: Send, color: "text-cestacorp-blue" },
    { label: "Formulários no mês", value: kpis.respostasMes, sub: "novas respostas", icon: FileText, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-cestacorp-blue">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral da operação — últimos {dias} dias</p>
        </div>
        <PeriodoSelector atual={dias} />
      </div>

      {!nomePerfil && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 text-amber-700 shrink-0" />
          <div className="flex-1">
            <b className="text-amber-900">Complete seu perfil.</b>{" "}
            <span className="text-amber-800">
              Seu nome está vazio — filtros como &ldquo;Minha semana&rdquo; precisam dele pra funcionar.
            </span>{" "}
            <Link href="/perfil" className="font-medium underline">Editar perfil</Link>
          </div>
        </div>
      )}

      {/* Ações rápidas */}
      <QuickActions />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {cardsKpi.map((k) => (
          <Card key={k.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">{k.label}</CardTitle>
              <k.icon className={`h-4 w-4 ${k.color}`} />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xl md:text-2xl font-bold">{k.value}</div>
              <div className="text-[11px] text-muted-foreground">{k.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gráfico principal: cobranças no tempo */}
      <Card>
        <CardHeader>
          <CardTitle>Cobranças nos últimos 6 meses</CardTitle>
          <CardDescription>Emitido vs. pago vs. em atraso (R$)</CardDescription>
        </CardHeader>
        <CardContent className="px-2 md:px-6">
          <CobrancasTimeline data={timeline} />
        </CardContent>
      </Card>

      {/* Régua e funil */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Mensagens da Régua — últimos 30 dias</CardTitle>
            <CardDescription>Volume diário por status</CardDescription>
          </CardHeader>
          <CardContent className="px-2 md:px-6">
            <ReguaStatusChart data={reguaStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Funil de formulários</CardTitle>
            <CardDescription>Status no total</CardDescription>
          </CardHeader>
          <CardContent className="px-2 md:px-6">
            <FormFunil data={funil} />
          </CardContent>
        </Card>
      </div>

      {/* Top atrasos + classificação + próximas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top 10 — clientes em atraso</CardTitle>
            <CardDescription>Ordenado por valor em aberto</CardDescription>
          </CardHeader>
          <CardContent>
            <TopAtrasos data={topAtrasos} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Classificação</CardTitle>
            <CardDescription>Clientes ativos</CardDescription>
          </CardHeader>
          <CardContent>
            <ClassificacaoPie data={classif} />
          </CardContent>
        </Card>
      </div>

      {/* Próximas cobranças */}
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
              {proximas.map((c) => (
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
