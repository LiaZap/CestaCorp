import Link from "next/link";
import { projetarReajustes } from "@/lib/services/reajuste-projecao";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, Calendar } from "lucide-react";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RANGES_VALIDOS = [3, 6, 12] as const;
type RangeMeses = (typeof RANGES_VALIDOS)[number];

export default async function ProjecaoReajustesPage({
  searchParams,
}: {
  searchParams: { meses?: string };
}) {
  const mesesRaw = Number(searchParams.meses ?? "3");
  const meses = (RANGES_VALIDOS.includes(mesesRaw as any) ? mesesRaw : 3) as RangeMeses;

  const proj = await projetarReajustes(meses);

  return (
    <div className="space-y-6">
      <Link href="/reajustes" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Reajustes
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
            <TrendingUp className="h-7 w-7" /> Projeção de reajustes
          </h1>
          <p className="text-muted-foreground">
            Patrick (call 18/05): "quero projetar os próximos 3 meses... saber quanto a gente
            tá tendo de reajuste". Aplica índice acumulado 12m atual sobre os contratos vigentes
            cujo <code>mesAniversarioReajuste</code> cai no range.
          </p>
        </div>
        <div className="flex gap-1 border rounded-md p-1 bg-white">
          {RANGES_VALIDOS.map((m) => (
            <Link
              key={m}
              href={`/reajustes/projecao?meses=${m}`}
              className={`px-3 py-1.5 rounded text-sm font-medium ${m === meses ? "bg-cestacorp-blue text-white" : "hover:bg-muted"}`}
            >
              {m === 12 ? "1 ano" : `${m} meses`}
            </Link>
          ))}
        </div>
      </div>

      {/* Totais consolidados */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          rotulo="Contratos no range"
          valor={String(proj.totais.qtdContratos)}
          sub={`${proj.totais.qtdClientes} clientes`}
        />
        <KpiCard
          rotulo="Receita atual mensal"
          valor={formatMoney(proj.totais.receitaAtualMensal)}
          sub="soma dos valorHonorarios"
        />
        <KpiCard
          rotulo="Projetada mensal"
          valor={formatMoney(proj.totais.receitaProjetadaMensal)}
          sub={`+${proj.totais.percentualMedio.toFixed(2)}% médio`}
          destaque
        />
        <KpiCard
          rotulo="Incremento anualizado"
          valor={formatMoney(proj.totais.incrementoAnualizado)}
          sub={`+${formatMoney(proj.totais.incrementoMensal)} / mês`}
          destaque
          variant="emerald"
        />
      </div>

      {/* Por mês */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Por mês
          </CardTitle>
          <CardDescription>Cada mês dentro do range com os totais</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {Object.keys(proj.porMes).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cliente com mês-aniversário no range escolhido.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Mês</th>
                  <th className="py-2 pr-3 text-right">Contratos</th>
                  <th className="py-2 pr-3 text-right">% médio</th>
                  <th className="py-2 pr-3 text-right">Atual</th>
                  <th className="py-2 pr-3 text-right">Projetado</th>
                  <th className="py-2 pr-3 text-right">Incremento mensal</th>
                  <th className="py-2 pr-3 text-right">Incremento anual</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(proj.porMes)
                  .sort((a, b) => (a.ano - b.ano) * 100 + (a.mes - b.mes))
                  .map((mes) => (
                    <tr key={`${mes.ano}-${mes.mes}`} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{mes.rotulo}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{mes.qtdContratos}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{mes.percentualMedio.toFixed(2)}%</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(mes.receitaAtualMensal)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums font-semibold text-cestacorp-blue">
                        {formatMoney(mes.receitaProjetadaMensal)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-emerald-700">
                        +{formatMoney(mes.incrementoMensal)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-emerald-700 font-semibold">
                        +{formatMoney(mes.incrementoAnualizado)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Detalhe cliente a cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento por cliente</CardTitle>
          <CardDescription>
            {proj.itens.length} {proj.itens.length === 1 ? "contrato" : "contratos"} com reajuste agendado no range
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {proj.itens.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada no horizonte.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Quando</th>
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Índice</th>
                  <th className="py-2 pr-3 text-right">% acumulado</th>
                  <th className="py-2 pr-3 text-right">Atual</th>
                  <th className="py-2 pr-3 text-right">Projetado</th>
                  <th className="py-2 pr-3 text-right">+ mensal</th>
                </tr>
              </thead>
              <tbody>
                {proj.itens.map((i) => (
                  <tr key={i.contratoId} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-2 pr-3">
                      <span className="text-xs font-mono bg-muted/60 rounded px-1.5 py-0.5">
                        {i.mesAniversarioNome.slice(0, 3)}/{i.ano}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <Link href={`/clientes/${i.clienteId}`} className="font-medium hover:underline">
                        {i.codigo != null && <span className="text-muted-foreground mr-1">#{i.codigo}</span>}
                        {i.razaoSocial}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-xs">{i.indice}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{i.percentual.toFixed(2)}%</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(i.valorAtual)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums font-semibold text-cestacorp-blue">
                      {formatMoney(i.valorProposto)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-emerald-700">
                      +{formatMoney(i.diferencaMensal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground italic">
        Cálculo aproximado: usa índice 12m atual pra todos os meses do range. Quando o reajuste for
        aplicado de fato, o número real do mês alvo será usado (via <code>aplicarReajuste</code>).
      </p>
    </div>
  );
}

function KpiCard({
  rotulo, valor, sub, destaque = false, variant,
}: {
  rotulo: string;
  valor: string;
  sub?: string;
  destaque?: boolean;
  variant?: "emerald";
}) {
  const cor = variant === "emerald"
    ? "text-emerald-700"
    : destaque ? "text-cestacorp-blue" : "";
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{rotulo}</p>
        <p className={`text-2xl font-bold tabular-nums mt-1 ${cor}`}>{valor}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
