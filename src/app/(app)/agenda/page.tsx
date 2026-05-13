import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { eventosDoMes, proximosEventos } from "@/lib/services/agenda";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarioMensal } from "@/components/CalendarioMensal";
import { Calendar, Plus, ChevronLeft, ChevronRight, Play, Settings } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default async function AgendaPage({ searchParams }: { searchParams: { m?: string; a?: string } }) {
  const hoje = new Date();
  const mes = Number(searchParams.m) || hoje.getMonth() + 1;
  const ano = Number(searchParams.a) || hoje.getFullYear();

  const [eventos, proximos, totalObrigacoes] = await Promise.all([
    eventosDoMes(ano, mes),
    proximosEventos(30),
    prisma.obrigacao.count({ where: { ativa: true } }),
  ]);

  const mesAnt = mes === 1 ? 12 : mes - 1;
  const anoAnt = mes === 1 ? ano - 1 : ano;
  const mesProx = mes === 12 ? 1 : mes + 1;
  const anoProx = mes === 12 ? ano + 1 : ano;

  const resumo = {
    pendentes: eventos.filter((e) => e.status === "PENDENTE").length,
    atrasados: eventos.filter((e) => e.status === "ATRASADO").length,
    concluidos: eventos.filter((e) => e.status === "CONCLUIDO").length,
    total: eventos.length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
            <Calendar className="h-7 w-7" /> Agenda
          </h1>
          <p className="text-muted-foreground">
            Obrigações fiscais e eventos — {totalObrigacoes} recorrências ativas
          </p>
        </div>
        <div className="flex gap-2">
          <form action="/api/agenda/materializar" method="post">
            <Button variant="secondary" type="submit">
              <Play className="h-4 w-4" /> Gerar eventos
            </Button>
          </form>
          <Button asChild variant="outline">
            <Link href="/agenda/obrigacoes">
              <Settings className="h-4 w-4" /> Obrigações
            </Link>
          </Button>
          <Button asChild>
            <Link href="/agenda/nova">
              <Plus className="h-4 w-4" /> Nova obrigação
            </Link>
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Pendentes (mês)</p>
          <p className="text-2xl font-bold text-amber-600">{resumo.pendentes}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Atrasados (mês)</p>
          <p className="text-2xl font-bold text-red-600">{resumo.atrasados}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Concluídos (mês)</p>
          <p className="text-2xl font-bold text-emerald-600">{resumo.concluidos}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Total (mês)</p>
          <p className="text-2xl font-bold">{resumo.total}</p>
        </CardContent></Card>
      </div>

      {/* Navegação */}
      <div className="flex items-center justify-between">
        <Link href={`/agenda?m=${mesAnt}&a=${anoAnt}`} className="inline-flex items-center gap-1 text-sm font-medium hover:text-primary">
          <ChevronLeft className="h-4 w-4" /> {MESES[mesAnt - 1]}
        </Link>
        <h2 className="text-xl font-bold text-cestacorp-blue">{MESES[mes - 1]} {ano}</h2>
        <Link href={`/agenda?m=${mesProx}&a=${anoProx}`} className="inline-flex items-center gap-1 text-sm font-medium hover:text-primary">
          {MESES[mesProx - 1]} <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <CalendarioMensal
        ano={ano}
        mes={mes}
        eventos={eventos.map((e) => ({
          id: e.id,
          titulo: e.titulo,
          dataVencimento: e.dataVencimento,
          status: e.status as any,
          cliente: e.cliente,
          obrigacao: e.obrigacao,
        }))}
      />

      {/* Próximos 30 dias */}
      <Card>
        <CardHeader>
          <CardTitle>Próximos 30 dias</CardTitle>
          <CardDescription>Eventos pendentes ou atrasados</CardDescription>
        </CardHeader>
        <CardContent>
          {proximos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento pendente nos próximos 30 dias 🎉</p>
          ) : (
            <ul className="divide-y">
              {proximos.map((e) => (
                <li key={e.id} className="py-3">
                  <Link href={`/agenda/${e.id}`} className="flex items-center justify-between gap-3 hover:bg-muted/50 -mx-2 px-2 rounded py-1">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono bg-muted rounded px-2 py-1 shrink-0">
                        {formatDate(e.dataVencimento)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {e.obrigacao?.tipo && <span className="text-muted-foreground mr-1">[{e.obrigacao.tipo}]</span>}
                          {e.titulo}
                        </p>
                        {e.cliente && (
                          <p className="text-xs text-muted-foreground truncate">{e.cliente.razaoSocial}</p>
                        )}
                      </div>
                    </div>
                    <span className={"status-badge " + (e.status === "ATRASADO" ? "status-erro" : "status-pendente")}>
                      {e.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
