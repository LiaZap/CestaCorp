import Link from "next/link";
import { getMovimentacaoMes, getDistribuicaoAtual } from "@/lib/services/movimentacao";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowDown, ArrowUp, Download, Calendar, TrendingUp, TrendingDown, Users } from "lucide-react";
import { formatDate, formatMoney, formatCpfCnpj } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default async function MovimentacaoPage({
  searchParams,
}: {
  searchParams: { ano?: string; mes?: string };
}) {
  const hoje = new Date();
  const ano = Number(searchParams.ano ?? hoje.getFullYear());
  const mes = Number(searchParams.mes ?? (hoje.getMonth() + 1));

  const [dados, distribuicao] = await Promise.all([
    getMovimentacaoMes(ano, mes),
    getDistribuicaoAtual(),
  ]);

  const saldo = dados.entradas.length - dados.saidas.length;
  const totalHonEntradas = dados.entradas.reduce((sum, c) => sum + (c.honorario ?? 0), 0);
  const totalHonSaidas = dados.saidas.reduce((sum, c) => sum + (c.honorario ?? 0), 0);

  // Lista de meses dos últimos 12 meses pra navegação rápida
  const mesesNav: { ano: number; mes: number; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    mesesNav.push({
      ano: d.getFullYear(),
      mes: d.getMonth() + 1,
      label: `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
    });
  }

  return (
    <div className="space-y-6">
      <Link href="/relatorios" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Relatórios
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
            <TrendingUp className="h-7 w-7" /> Movimentação de carteira
          </h1>
          <p className="text-muted-foreground">
            Entradas e saídas de clientes em {MESES[mes - 1]}/{ano} · usado nas reuniões mensais
          </p>
        </div>
        <Button asChild>
          <a href={`/api/relatorios/movimentacao?ano=${ano}&mes=${mes}&format=csv`}>
            <Download className="h-4 w-4" /> Exportar CSV
          </a>
        </Button>
      </div>

      {/* Navegação rápida pelos meses */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {mesesNav.map((m) => {
          const ativo = m.ano === ano && m.mes === mes;
          return (
            <Link
              key={`${m.ano}-${m.mes}`}
              href={`/relatorios/movimentacao?ano=${m.ano}&mes=${m.mes}`}
              className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                ativo ? "bg-cestacorp-blue text-white shadow" : "bg-white border hover:border-cestacorp-blue/40"
              }`}
            >
              {m.label}
            </Link>
          );
        })}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Entradas</p>
            <p className="text-3xl font-bold text-emerald-600 flex items-center gap-2 mt-1">
              <ArrowUp className="h-5 w-5" /> {dados.entradas.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalHonEntradas > 0 && `+ ${formatMoney(totalHonEntradas)}/mês`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saídas</p>
            <p className="text-3xl font-bold text-red-600 flex items-center gap-2 mt-1">
              <ArrowDown className="h-5 w-5" /> {dados.saidas.length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {totalHonSaidas > 0 && `− ${formatMoney(totalHonSaidas)}/mês`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saldo do mês</p>
            <p className={`text-3xl font-bold mt-1 ${saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {saldo >= 0 ? "+" : ""}{saldo}
            </p>
            <p className="text-xs text-muted-foreground mt-1">clientes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total ativo</p>
            <p className="text-3xl font-bold text-cestacorp-blue mt-1 flex items-center gap-2">
              <Users className="h-5 w-5" /> {dados.totalAtivo.toLocaleString("pt-BR")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">no fim de {MESES[mes - 1]}</p>
          </CardContent>
        </Card>
      </div>

      {/* Resumo por regime (movimentação) */}
      {dados.resumoPorRegime.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por regime tributário</CardTitle>
            <CardDescription>Movimentação detalhada</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Regime</th>
                  <th className="py-2 pr-3 text-right">Entradas</th>
                  <th className="py-2 pr-3 text-right">Saídas</th>
                  <th className="py-2 pr-3 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {dados.resumoPorRegime.map((r) => (
                  <tr key={r.regime} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{r.regime}</td>
                    <td className="py-2 pr-3 text-right text-emerald-700 tabular-nums">
                      {r.entradas > 0 ? `+${r.entradas}` : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right text-red-700 tabular-nums">
                      {r.saidas > 0 ? `−${r.saidas}` : "—"}
                    </td>
                    <td className={`py-2 pr-3 text-right font-bold tabular-nums ${
                      r.entradas - r.saidas >= 0 ? "text-emerald-700" : "text-red-700"
                    }`}>
                      {r.entradas - r.saidas >= 0 ? "+" : ""}{r.entradas - r.saidas}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Listas nominais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-emerald-700">
              <ArrowUp className="h-5 w-5" /> Entrando ({dados.entradas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dados.entradas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma entrada neste mês.</p>
            ) : (
              <ul className="divide-y">
                {dados.entradas.map((c) => (
                  <li key={c.id} className="py-2 text-sm">
                    <Link href={`/clientes/${c.id}`} className="hover:underline font-medium">
                      {c.codigo && <span className="text-muted-foreground">#{c.codigo} · </span>}
                      {c.razaoSocial}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {c.tributacao ?? "—"} · {formatCpfCnpj(c.cpfCnpj)}
                      {c.honorario && ` · ${formatMoney(c.honorario)}/mês`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-700">
              <ArrowDown className="h-5 w-5" /> Saindo ({dados.saidas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dados.saidas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma saída neste mês.</p>
            ) : (
              <ul className="divide-y">
                {dados.saidas.map((c) => (
                  <li key={c.id} className="py-2 text-sm">
                    <Link href={`/clientes/${c.id}`} className="hover:underline font-medium">
                      {c.codigo && <span className="text-muted-foreground">#{c.codigo} · </span>}
                      {c.razaoSocial}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {c.tributacao ?? "—"} · {formatCpfCnpj(c.cpfCnpj)}
                      {c.fim && ` · saiu em ${formatDate(c.fim)}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Distribuição atual (snapshot) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Por regime hoje</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {distribuicao.porRegime.slice(0, 8).map((r) => (
                <li key={r.regime} className="flex justify-between">
                  <span className="text-muted-foreground truncate pr-2">{r.regime}</span>
                  <span className="font-bold tabular-nums">{r.total}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Por classificação</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {distribuicao.porClassificacao.map((c) => (
                <li key={c.classificacao} className="flex justify-between">
                  <span className="text-muted-foreground">{c.classificacao}</span>
                  <span className="font-bold tabular-nums">{c.total}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 prefeituras</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {distribuicao.porPrefeitura.map((p) => (
                <li key={p.prefeitura} className="flex justify-between">
                  <span className="text-muted-foreground truncate pr-2">{p.prefeitura}</span>
                  <span className="font-bold tabular-nums">{p.total}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
