import Link from "next/link";
import { getHistoricoAnual, getDistribuicaoAtual } from "@/lib/services/movimentacao";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, History, TrendingUp, TrendingDown } from "lucide-react";
import { HistoricoChart } from "./HistoricoChart";

export const dynamic = "force-dynamic";

export default async function HistoricoPage({
  searchParams,
}: {
  searchParams: { ano?: string };
}) {
  const hoje = new Date();
  const ano = Number(searchParams.ano ?? hoje.getFullYear());

  const [historico, distribuicao] = await Promise.all([
    getHistoricoAnual(ano),
    getDistribuicaoAtual(),
  ]);

  const totalEntradas = historico.meses.reduce((s, m) => s + m.entradas, 0);
  const totalSaidas = historico.meses.reduce((s, m) => s + m.saidas, 0);
  const saldoAno = totalEntradas - totalSaidas;
  const carteiraAtual = historico.meses[hoje.getMonth()]?.ativos ?? 0;
  const ultimoMes = historico.meses[hoje.getMonth()] ?? historico.meses[historico.meses.length - 1];

  // Anos pra navegação (5 anos pra trás)
  const anosNav = [];
  for (let i = 0; i < 5; i++) anosNav.push(hoje.getFullYear() - i);

  return (
    <div className="space-y-6">
      <Link href="/relatorios" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Relatórios
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <History className="h-7 w-7" /> Histórico anual {ano}
        </h1>
        <p className="text-muted-foreground">
          Evolução mensal de carteira, entradas e saídas. Use para acompanhar tendências.
        </p>
      </div>

      {/* Navegação por ano */}
      <div className="flex gap-1 flex-wrap">
        {anosNav.map((a) => {
          const ativo = a === ano;
          return (
            <Link
              key={a}
              href={`/relatorios/historico?ano=${a}`}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                ativo ? "bg-cestacorp-blue text-white shadow" : "bg-white border hover:border-cestacorp-blue/40"
              }`}
            >
              {a}
            </Link>
          );
        })}
      </div>

      {/* KPIs do ano */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Entradas no ano</p>
            <p className="text-3xl font-bold text-emerald-600 mt-1">{totalEntradas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saídas no ano</p>
            <p className="text-3xl font-bold text-red-600 mt-1">{totalSaidas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo {ano}</p>
            <p className={`text-3xl font-bold mt-1 flex items-center gap-2 ${
              saldoAno >= 0 ? "text-emerald-600" : "text-red-600"
            }`}>
              {saldoAno >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              {saldoAno >= 0 ? "+" : ""}{saldoAno}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Carteira atual</p>
            <p className="text-3xl font-bold text-cestacorp-blue mt-1">{carteiraAtual.toLocaleString("pt-BR")}</p>
            <p className="text-xs text-muted-foreground">clientes ativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico evolutivo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimentação mensal {ano}</CardTitle>
          <CardDescription>Entradas (verde), saídas (vermelho), carteira ativa (azul)</CardDescription>
        </CardHeader>
        <CardContent>
          <HistoricoChart data={historico.meses} />
        </CardContent>
      </Card>

      {/* Tabela detalhada por mês */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento mês a mês</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Mês</th>
                <th className="py-2 pr-3 text-right">Entradas</th>
                <th className="py-2 pr-3 text-right">Saídas</th>
                <th className="py-2 pr-3 text-right">Saldo</th>
                <th className="py-2 pr-3 text-right">Ativos no fim</th>
                <th className="py-2 pr-3 text-right">Detalhar</th>
              </tr>
            </thead>
            <tbody>
              {historico.meses.map((m) => (
                <tr key={m.mes} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 pr-3 font-medium">{m.label}/{ano}</td>
                  <td className="py-2 pr-3 text-right text-emerald-700 tabular-nums">
                    {m.entradas > 0 ? `+${m.entradas}` : "—"}
                  </td>
                  <td className="py-2 pr-3 text-right text-red-700 tabular-nums">
                    {m.saidas > 0 ? `−${m.saidas}` : "—"}
                  </td>
                  <td className={`py-2 pr-3 text-right font-bold tabular-nums ${
                    m.saldo >= 0 ? "text-emerald-700" : "text-red-700"
                  }`}>
                    {m.saldo >= 0 ? "+" : ""}{m.saldo}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums font-semibold">
                    {m.ativos.toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <Link
                      href={`/relatorios/movimentacao?ano=${ano}&mes=${m.mes}`}
                      className="text-cestacorp-blue hover:underline text-xs"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Distribuição atual */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por regime (snapshot atual)</CardTitle>
            <CardDescription>Total de clientes ativos por tributação</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {distribuicao.porRegime.map((r) => {
                const total = distribuicao.porRegime.reduce((s, x) => s + x.total, 0);
                const pct = total > 0 ? (r.total / total) * 100 : 0;
                return (
                  <li key={r.regime} className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium truncate pr-2">{r.regime}</span>
                      <span className="tabular-nums">
                        {r.total} <span className="text-muted-foreground">({pct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-cestacorp-blue" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top municípios</CardTitle>
            <CardDescription>Onde estão concentrados os clientes</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {distribuicao.porPrefeitura.map((p) => {
                const total = distribuicao.porPrefeitura.reduce((s, x) => s + x.total, 0);
                const pct = total > 0 ? (p.total / total) * 100 : 0;
                return (
                  <li key={p.prefeitura} className="space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium truncate pr-2">{p.prefeitura}</span>
                      <span className="tabular-nums">{p.total}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
