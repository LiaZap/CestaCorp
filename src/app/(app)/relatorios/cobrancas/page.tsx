import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RelatorioCobrancasPage() {
  const [porStatus, ticketMedio, totalMes, topClientes] = await Promise.all([
    prisma.cobranca.groupBy({ by: ["status"], _count: true, _sum: { valor: true } }),
    prisma.cobranca.aggregate({ _avg: { valor: true }, where: { status: "PAGO" } }),
    prisma.cobranca.aggregate({
      _sum: { valor: true },
      where: {
        status: "PAGO",
        dataPagamento: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
    prisma.cobranca.groupBy({
      by: ["clienteId"],
      _sum: { valor: true },
      where: { status: "PAGO" },
      orderBy: { _sum: { valor: "desc" } },
      take: 10,
    }),
  ]);

  const ids = topClientes.map((t) => t.clienteId);
  const clientes = await prisma.cliente.findMany({ where: { id: { in: ids } }, select: { id: true, razaoSocial: true } });
  const nomes = Object.fromEntries(clientes.map((c) => [c.id, c.razaoSocial]));

  return (
    <div className="space-y-6">
      <Link href="/relatorios" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Relatórios
      </Link>
      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue">Relatório de Cobranças</h1>
        <p className="text-muted-foreground">Visão consolidada financeira</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Pago no mês atual</p>
          <p className="text-2xl font-bold text-cestacorp-green">{formatMoney(Number(totalMes._sum.valor ?? 0))}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Ticket médio</p>
          <p className="text-2xl font-bold">{formatMoney(Number(ticketMedio._avg.valor ?? 0))}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Total registrado</p>
          <p className="text-2xl font-bold">{porStatus.reduce((a, s) => a + s._count, 0)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Por status</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground text-left">
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Qtd</th>
                <th className="py-2 pr-3">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {porStatus.map((s) => (
                <tr key={s.status} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    <span className={"status-badge " + (s.status === "PAGO" ? "status-pago" : s.status === "ATRASADO" ? "status-atraso" : "status-aberto")}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{s._count}</td>
                  <td className="py-2 pr-3 font-medium">{formatMoney(Number(s._sum.valor ?? 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top 10 clientes por receita paga (histórico)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {topClientes.map((t) => (
              <li key={t.clienteId} className="py-2 flex justify-between">
                <Link href={`/clientes/${t.clienteId}`} className="hover:text-primary">{nomes[t.clienteId] ?? "—"}</Link>
                <span className="font-medium text-cestacorp-green">{formatMoney(Number(t._sum.valor ?? 0))}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
