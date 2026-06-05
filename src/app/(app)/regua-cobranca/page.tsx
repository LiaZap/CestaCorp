import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatMoney } from "@/lib/utils";
import {
  Plus, Play, CheckCircle2, AlertTriangle, Clock, SkipForward,
  Send, TrendingUp, Target, Zap, MessageSquare, ChevronRight,
  Beaker, Megaphone,
} from "lucide-react";
import { getReguaMetrics } from "@/lib/services/regua-metrics";
import { ReguaVolumeChart } from "@/components/charts/ReguaVolumeChart";
import { distribuicaoInadimplencia, topInadimplentes } from "@/lib/services/inadimplencia";
import { InadimplenciaPanel } from "@/components/InadimplenciaPanel";

export const dynamic = "force-dynamic";

const statusStyle: Record<string, string> = {
  PENDENTE: "status-pendente",
  ENVIADO: "status-pago",
  ERRO: "status-erro",
  PULADO: "status-aberto",
  CANCELADO: "status-aberto",
};

export default async function ReguaCobrancaPage() {
  const [reguas, execucoes, metrics, inadDist, inadTop] = await Promise.all([
    prisma.reguaCobranca.findMany({
      include: { _count: { select: { passos: true, execucoes: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.execucaoRegua.findMany({
      take: 30,
      orderBy: [{ status: "asc" }, { agendadoPara: "desc" }],
      include: {
        cliente: { select: { razaoSocial: true } },
        passo: { select: { nome: true, canal: true } },
        cobranca: { select: { valor: true, vencimento: true } },
      },
    }),
    getReguaMetrics(),
    distribuicaoInadimplencia(),
    topInadimplentes(10),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
            <MessageSquare className="h-7 w-7" />
            Régua de Cobrança
          </h1>
          <p className="text-muted-foreground">
            Automação NIBO → DIGISAC · disparos programados conforme régua configurada
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild variant="outline">
            <Link href="/regua-cobranca/simular">
              <Beaker className="h-4 w-4" />
              Simular
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/regua-cobranca/lote">
              <Megaphone className="h-4 w-4" />
              Envio em lote
            </Link>
          </Button>
          <form action="/api/reguas/run-now" method="post">
            <Button variant="secondary" type="submit">
              <Play className="h-4 w-4" />
              Rodar agora
            </Button>
          </form>
          <Button asChild>
            <Link href="/regua-cobranca/nova">
              <Plus className="h-4 w-4" />
              Nova régua
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs da régua */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 h-16 w-16 bg-emerald-100/70 rounded-bl-full" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase text-muted-foreground tracking-wider">Taxa de entrega</p>
              <Target className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-3xl font-bold text-emerald-700 mt-1">{metrics.taxaEntrega}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.enviados} enviadas · {metrics.erros} erros
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 h-16 w-16 bg-blue-100/70 rounded-bl-full" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase text-muted-foreground tracking-wider">Conversão em pagto</p>
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-cestacorp-blue mt-1">{metrics.taxaConversao}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.cobrancasConvertidas} cobranças resolvidas
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 h-16 w-16 bg-amber-100/70 rounded-bl-full" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase text-muted-foreground tracking-wider">Pendentes</p>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-3xl font-bold text-amber-700 mt-1">{metrics.pendentes}</p>
            <p className="text-xs text-muted-foreground mt-1">aguardando horário</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 h-16 w-16 bg-violet-100/70 rounded-bl-full" />
          <CardContent className="pt-6 relative">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase text-muted-foreground tracking-wider">Melhor horário</p>
              <Zap className="h-4 w-4 text-violet-600" />
            </div>
            <p className="text-3xl font-bold text-violet-700 mt-1">{metrics.melhorHorario}</p>
            <p className="text-xs text-muted-foreground mt-1">maior volume de envio</p>
          </CardContent>
        </Card>
      </div>

      {/* Inadimplência por nível (Patrick call 18/05) */}
      <InadimplenciaPanel distribuicao={inadDist} topInadimplentes={inadTop} />

      {/* Volume por dia */}
      <Card>
        <CardHeader>
          <CardTitle>Volume de mensagens — últimos 14 dias</CardTitle>
          <CardDescription>Mensagens enviadas com sucesso por dia</CardDescription>
        </CardHeader>
        <CardContent className="px-2 md:px-6">
          <ReguaVolumeChart data={metrics.serie} />
        </CardContent>
      </Card>

      {/* Lista de réguas */}
      <Card>
        <CardHeader>
          <CardTitle>Réguas configuradas</CardTitle>
          <CardDescription>Cada régua possui uma sequência de passos com offset + canal + template</CardDescription>
        </CardHeader>
        <CardContent>
          {reguas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma régua criada ainda. Clique em <b>Nova régua</b> para começar.
            </p>
          ) : (
            <ul className="divide-y">
              {reguas.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/regua-cobranca/${r.id}`}
                    className="flex items-center justify-between py-4 hover:bg-muted/50 -mx-2 px-2 rounded-md group"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={
                        "h-10 w-10 rounded-full flex items-center justify-center shrink-0 " +
                        (r.ativa ? "bg-cestacorp-green/15 text-cestacorp-green" : "bg-slate-100 text-slate-400")
                      }>
                        <Play className="h-5 w-5" fill={r.ativa ? "currentColor" : "none"} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold">{r.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {r._count.passos} passos · {r._count.execucoes} execuções · {r.ativa ? <span className="text-cestacorp-green font-medium">ativa</span> : "pausada"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-cestacorp-blue transition" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Execuções recentes */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Últimas execuções</CardTitle>
            <CardDescription>Todas as réguas, ordenado por pendentes primeiro</CardDescription>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1 text-amber-700">
              <Clock className="h-3 w-3" /> {metrics.pendentes} pendentes
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> {metrics.enviados} enviadas
            </span>
            {metrics.erros > 0 && (
              <span className="inline-flex items-center gap-1 text-red-700">
                <AlertTriangle className="h-3 w-3" /> {metrics.erros} erros
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b text-muted-foreground">
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Passo</th>
                <th className="py-2 pr-3">Canal</th>
                <th className="py-2 pr-3">Agendado</th>
                <th className="py-2 pr-3">Valor</th>
              </tr>
            </thead>
            <tbody>
              {execucoes.map((e) => (
                <tr key={e.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="py-2 pr-3">
                    <span className={"status-badge " + statusStyle[e.status]}>{e.status}</span>
                  </td>
                  <td className="py-2 pr-3">
                    <Link href={`/regua-cobranca/execucao/${e.id}`} className="hover:underline font-medium">
                      {e.cliente.razaoSocial}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">{e.passo.nome}</td>
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-1 text-xs">
                      {e.passo.canal === "WHATSAPP" && <><span className="h-2 w-2 rounded-full bg-emerald-500" /> WhatsApp</>}
                      {e.passo.canal === "EMAIL" && <><span className="h-2 w-2 rounded-full bg-blue-500" /> E-mail</>}
                      {e.passo.canal === "SMS" && <><span className="h-2 w-2 rounded-full bg-slate-500" /> SMS</>}
                    </span>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap text-xs">{formatDateTime(e.agendadoPara)}</td>
                  <td className="py-2 pr-3 font-medium">
                    {e.cobranca?.valor ? formatMoney(Number(e.cobranca.valor)) : "—"}
                  </td>
                </tr>
              ))}
              {execucoes.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Sem execuções ainda. Rode a régua após configurar passos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
