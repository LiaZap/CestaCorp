import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Upload, ArrowRight } from "lucide-react";
import { formatMoney, formatDate, formatCpfCnpj } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function NotasFiscaisPage() {
  const [notas, totais] = await Promise.all([
    prisma.notaFiscal.findMany({
      orderBy: { dataEmissao: "desc" },
      take: 50,
      include: { cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } } },
    }),
    prisma.notaFiscal.aggregate({ _count: true, _sum: { valorTotal: true } }),
  ]);

  const porTipo = await prisma.notaFiscal.groupBy({ by: ["tipo"], _count: true, _sum: { valorTotal: true } });
  const byTipo = Object.fromEntries(porTipo.map((t) => [t.tipo, t]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
            <FileText className="h-7 w-7" /> Notas Fiscais
          </h1>
          <p className="text-muted-foreground">Importação e consulta de NF-e dos clientes</p>
        </div>
        <Button asChild>
          <Link href="/notas-fiscais/importar">
            <Upload className="h-4 w-4" /> Importar XML
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Total de notas</p>
          <p className="text-2xl font-bold mt-1">{totais._count}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Saídas</p>
          <p className="text-2xl font-bold mt-1 text-emerald-700">{formatMoney(Number(byTipo.saida?._sum?.valorTotal ?? 0))}</p>
          <p className="text-xs text-muted-foreground">{byTipo.saida?._count ?? 0} nota(s)</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Entradas</p>
          <p className="text-2xl font-bold mt-1 text-blue-700">{formatMoney(Number(byTipo.entrada?._sum?.valorTotal ?? 0))}</p>
          <p className="text-xs text-muted-foreground">{byTipo.entrada?._count ?? 0} nota(s)</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimas 50 notas importadas</CardTitle>
        </CardHeader>
        <CardContent>
          {notas.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nenhuma nota fiscal ainda"
              description="Faça upload de arquivos XML (NFe/NFCe) para começar."
              cta={{ href: "/notas-fiscais/importar", label: "Importar XML" }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">Data</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Número</th>
                    <th className="py-2 pr-3">Emitente / Destinatário</th>
                    <th className="py-2 pr-3">Cliente vinculado</th>
                    <th className="py-2 pr-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {notas.map((n) => (
                    <tr key={n.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDate(n.dataEmissao)}</td>
                      <td className="py-2 pr-3">
                        <span className={
                          "status-badge text-[10px] " +
                          (n.tipo === "saida" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700")
                        }>
                          {n.tipo === "saida" ? "↗ saída" : "↙ entrada"}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{n.numero}{n.serie && `/${n.serie}`}</td>
                      <td className="py-2 pr-3">
                        <p className="font-medium truncate max-w-xs">{n.emitenteNome}</p>
                        <p className="text-xs text-muted-foreground font-mono">{formatCpfCnpj(n.emitenteCnpj)}</p>
                      </td>
                      <td className="py-2 pr-3">
                        {n.cliente ? (
                          <Link href={`/clientes/${n.cliente.id}`} className="text-cestacorp-blue hover:underline text-xs">
                            {n.cliente.nomeFantasia ?? n.cliente.razaoSocial}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">não vinculado</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono">{formatMoney(Number(n.valorTotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
