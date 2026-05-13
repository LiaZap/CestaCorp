import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { gerarPropostasReajuste, obterIndiceAcumulado12m } from "@/lib/services/reajuste";
import { formatMoney } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default async function ReajustesPage({ searchParams }: { searchParams: { mes?: string } }) {
  const mesAtual = searchParams.mes ? Number(searchParams.mes) : new Date().getMonth() + 1;
  const [propostas, ipca, igpm, inpc] = await Promise.all([
    gerarPropostasReajuste(mesAtual),
    obterIndiceAcumulado12m("IPCA").catch(() => 0),
    obterIndiceAcumulado12m("IGPM").catch(() => 0),
    obterIndiceAcumulado12m("INPC").catch(() => 0),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue">Reajustes</h1>
        <p className="text-muted-foreground">
          Propostas para clientes cujo aniversário é em <b>{MESES[mesAtual - 1]}</b>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">IPCA 12m</p>
          <p className="text-2xl font-bold text-cestacorp-blue">{ipca.toFixed(2)}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">IGP-M 12m</p>
          <p className="text-2xl font-bold text-cestacorp-blue">{igpm.toFixed(2)}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">INPC 12m</p>
          <p className="text-2xl font-bold text-cestacorp-blue">{inpc.toFixed(2)}%</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{propostas.length} proposta(s)</CardTitle>
          <CardDescription>Revise e aplique individualmente. Nada é aplicado automaticamente.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {propostas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum cliente com aniversário em {MESES[mesAtual - 1]} ou sem valor vigente.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Índice</th>
                  <th className="py-2 pr-3">%</th>
                  <th className="py-2 pr-3">Atual</th>
                  <th className="py-2 pr-3">Proposto</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {propostas.map((p) => (
                  <tr key={p.clienteId} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{p.razaoSocial}</td>
                    <td className="py-2 pr-3">{p.indice}</td>
                    <td className="py-2 pr-3">{p.percentual.toFixed(2)}%</td>
                    <td className="py-2 pr-3">{formatMoney(p.valorAtual)}</td>
                    <td className="py-2 pr-3 font-semibold text-cestacorp-green">{formatMoney(p.valorProposto)}</td>
                    <td className="py-2 pr-3">
                      <form action="/api/reajustes/propostas" method="post" className="inline">
                        <input type="hidden" name="clienteId" value={p.clienteId} />
                        <Button size="sm" type="submit">
                          <TrendingUp className="h-3 w-3" /> Aplicar
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Fonte: Banco Central do Brasil — SGS (séries 433 IPCA · 189 IGP-M · 188 INPC).
      </p>
    </div>
  );
}
