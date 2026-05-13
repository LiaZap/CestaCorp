import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { ReguaEditor } from "../ReguaEditor";
import { TimelinePassos } from "@/components/TimelinePassos";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { getReguaMetrics, getPassoStats } from "@/lib/services/regua-metrics";
import { ArrowLeft, Target, TrendingUp, Clock, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EditarReguaPage({ params }: { params: { id: string } }) {
  const regua = await prisma.reguaCobranca.findUnique({
    where: { id: params.id },
    include: { passos: { orderBy: { ordem: "asc" } } },
  });
  if (!regua) notFound();

  const [metrics, passosStats] = await Promise.all([
    getReguaMetrics(regua.id),
    getPassoStats(regua.id),
  ]);

  return (
    <div className="space-y-6 max-w-6xl">
      <Link href="/regua-cobranca" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Régua de Cobrança
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-cestacorp-blue">{regua.nome}</h1>
          {regua.descricao && <p className="text-muted-foreground">{regua.descricao}</p>}
          <div className="mt-2 flex gap-2">
            <span className={"status-badge " + (regua.ativa ? "status-ativo" : "status-aberto")}>
              {regua.ativa ? "ativa" : "pausada"}
            </span>
            <span className="status-badge status-aberto">{regua.passos.length} passos</span>
          </div>
        </div>
      </div>

      {/* KPIs desta régua */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase text-muted-foreground">Taxa entrega</p>
            <Target className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{metrics.taxaEntrega}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase text-muted-foreground">Conversão</p>
            <TrendingUp className="h-4 w-4 text-cestacorp-blue" />
          </div>
          <p className="text-2xl font-bold text-cestacorp-blue mt-1">{metrics.taxaConversao}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase text-muted-foreground">Pendentes</p>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-1">{metrics.pendentes}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase text-muted-foreground">Melhor horário</p>
            <Zap className="h-4 w-4 text-violet-600" />
          </div>
          <p className="text-2xl font-bold text-violet-700 mt-1">{metrics.melhorHorario}</p>
        </CardContent></Card>
      </div>

      {/* Timeline visual */}
      <Card>
        <CardHeader>
          <CardTitle>Linha do tempo dos passos</CardTitle>
          <CardDescription>Relativo ao vencimento da cobrança · números mostram envios por passo</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <TimelinePassos passos={passosStats} />
        </CardContent>
      </Card>

      <h2 className="text-xl font-bold text-cestacorp-blue pt-4">Editar passos e mensagens</h2>

      <ReguaEditor
        initial={{
          id: regua.id,
          nome: regua.nome,
          descricao: regua.descricao ?? "",
          ativa: regua.ativa,
          passos: regua.passos.map((p) => ({
            id: p.id,
            nome: p.nome,
            offsetDias: p.offsetDias,
            canal: p.canal as any,
            templateMsg: p.templateMsg,
            horarioEnvio: p.horarioEnvio ?? "09:00",
            soDiasUteis: p.soDiasUteis,
          })),
        }}
      />
    </div>
  );
}
