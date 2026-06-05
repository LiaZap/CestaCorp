import Link from "next/link";
import { relatorioLtv } from "@/lib/services/ltv";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, Users, Clock, DollarSign } from "lucide-react";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

const NOMES_STATUS: Record<string, string> = {
  ATIVO: "Ativos",
  INATIVO: "Inativos",
  ENCERRADO: "Encerrados",
  PROSPECT: "Prospects",
  SUSPENSO: "Suspensos",
};

export default async function LtvPage() {
  const r = await relatorioLtv();

  return (
    <div className="space-y-6">
      <Link href="/relatorios" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Relatórios
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <TrendingUp className="h-7 w-7" /> LTV — Lifetime Value
        </h1>
        <p className="text-muted-foreground">
          Quanto tempo os clientes ficam na base · receita acumulada média ·
          Patrick: "a média que os clientes ficam na nossa base". Usa{" "}
          <code>Cliente.inicio</code> e <code>Cliente.dataEncerramento</code> da V-106.
        </p>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icone={<Users className="h-4 w-4 text-cestacorp-blue" />}
          rotulo="Clientes com dados"
          valor={String(r.total.qtdClientes)}
          sub={`base do cálculo`}
        />
        <KpiCard
          icone={<Clock className="h-4 w-4 text-emerald-600" />}
          rotulo="Duração média"
          valor={`${r.total.duracaoMediaMeses.toFixed(1)} meses`}
          sub={`máx ${r.total.duracaoMaximaMeses.toFixed(0)} · mín ${r.total.duracaoMinimaMeses.toFixed(0)}`}
        />
        <KpiCard
          icone={<DollarSign className="h-4 w-4 text-amber-600" />}
          rotulo="Honorário médio/mês"
          valor={formatMoney(r.total.honorarioMedioMensal)}
          sub="ponderado por cliente"
        />
        <KpiCard
          icone={<TrendingUp className="h-4 w-4 text-purple-600" />}
          rotulo="LTV médio"
          valor={formatMoney(r.total.ltvMedio)}
          sub={`receita acumulada total ${formatMoney(r.total.receitaTotalAcumulada)}`}
        />
      </div>

      {/* Por dimensão */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SegmentTable titulo="Por status" rotulos={NOMES_STATUS} dados={r.porStatus} />
        <SegmentTable titulo="Por classificação" dados={r.porClassificacao} />
        <SegmentTable titulo="Por categoria/segmento" dados={r.porCategoria} />
        <SegmentTable titulo="Por tributação" dados={r.porTributacao} />
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 15 clientes mais antigos</CardTitle>
            <CardDescription>Maior duração na base</CardDescription>
          </CardHeader>
          <CardContent>
            <RankingTable dados={r.topMaisAntigos} chave="duracao" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 15 maiores LTV</CardTitle>
            <CardDescription>Receita acumulada estimada</CardDescription>
          </CardHeader>
          <CardContent>
            <RankingTable dados={r.topMaiorLtv} chave="ltv" />
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground italic">
        Cálculo: duração em meses entre <code>inicio</code> e <code>dataEncerramento</code> (ou hoje, se ativo).
        Honorário médio = média dos pagamentos com status PAGO (fallback: maior <code>valorHonorarios</code> dos contratos).
        LTV = duração × honorário médio mensal.
      </p>
    </div>
  );
}

function KpiCard({
  icone,
  rotulo,
  valor,
  sub,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valor: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{rotulo}</p>
          {icone}
        </div>
        <p className="text-2xl font-bold tabular-nums mt-1">{valor}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function SegmentTable({
  titulo,
  rotulos,
  dados,
}: {
  titulo: string;
  rotulos?: Record<string, string>;
  dados: Array<{
    segmento: string;
    qtdClientes: number;
    duracaoMediaMeses: number;
    honorarioMedioMensal: number;
    ltvMedio: number;
    receitaTotalAcumulada: number;
  }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {dados.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground text-xs">
                <th className="py-1.5 pr-3">Segmento</th>
                <th className="py-1.5 pr-3 text-right">Clientes</th>
                <th className="py-1.5 pr-3 text-right">Dur. média</th>
                <th className="py-1.5 pr-3 text-right">Hon./mês</th>
                <th className="py-1.5 pr-3 text-right">LTV médio</th>
                <th className="py-1.5 pr-3 text-right">Receita total</th>
              </tr>
            </thead>
            <tbody>
              {dados.map((d) => (
                <tr key={d.segmento} className="border-b last:border-0">
                  <td className="py-1.5 pr-3 font-medium">{rotulos?.[d.segmento] ?? d.segmento}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{d.qtdClientes}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{d.duracaoMediaMeses.toFixed(1)}m</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{formatMoney(d.honorarioMedioMensal)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums font-semibold text-cestacorp-blue">
                    {formatMoney(d.ltvMedio)}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                    {formatMoney(d.receitaTotalAcumulada)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function RankingTable({
  dados,
  chave,
}: {
  dados: Array<{
    id: string;
    razaoSocial: string;
    codigo: number | null;
    duracaoMeses: number;
    ltv: number;
    ativo: boolean;
  }>;
  chave: "duracao" | "ltv";
}) {
  if (dados.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados.</p>;
  }
  return (
    <ul className="divide-y">
      {dados.map((c, i) => (
        <li key={c.id} className="py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}.</span>
            <Link href={`/clientes/${c.id}`} className="font-medium hover:underline truncate">
              {c.codigo != null && <span className="text-muted-foreground mr-1">#{c.codigo}</span>}
              {c.razaoSocial}
            </Link>
            {c.ativo && <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded px-1">ativo</span>}
          </div>
          <span className="font-semibold tabular-nums text-cestacorp-blue text-sm">
            {chave === "duracao" ? `${c.duracaoMeses.toFixed(1)} m` : formatMoney(c.ltv)}
          </span>
        </li>
      ))}
    </ul>
  );
}
