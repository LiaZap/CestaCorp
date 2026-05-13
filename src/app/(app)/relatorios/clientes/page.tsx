import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RelatorioClientesPage() {
  const [porStatus, porClassif, porResponsavelFiscal, totalAtivos] = await Promise.all([
    prisma.cliente.groupBy({ by: ["status"], _count: true }),
    prisma.cliente.groupBy({ by: ["classificacao"], _count: true, where: { status: "ATIVO" } }),
    prisma.cliente.groupBy({ by: ["respFiscal"], _count: true, where: { status: "ATIVO" } }),
    prisma.cliente.count({ where: { status: "ATIVO" } }),
  ]);

  const responsavelRanked = porResponsavelFiscal
    .filter((r) => r.respFiscal)
    .sort((a, b) => b._count - a._count);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/relatorios" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Relatórios
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3 mt-2">
          <div>
            <h1 className="text-3xl font-bold text-cestacorp-blue">Relatório de Clientes</h1>
            <p className="text-muted-foreground">Distribuição por status, classificação e responsável</p>
          </div>
          <Button asChild variant="outline">
            <a href="/api/relatorios/clientes.csv"><Download className="h-4 w-4" /> Baixar CSV</a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Por status</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {porStatus.map((s) => (
                <li key={s.status} className="flex justify-between text-sm">
                  <span>{s.status}</span><span className="font-medium">{s._count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Por classificação (ativos)</CardTitle>
            <CardDescription>{totalAtivos} clientes ativos</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {porClassif.map((c, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span>{c.classificacao ?? "Sem classificação"}</span>
                  <span className="font-medium">{c._count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Carga por responsável fiscal</CardTitle>
        </CardHeader>
        <CardContent>
          {responsavelRanked.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum responsável cadastrado nos clientes.</p>
          ) : (
            <ul className="space-y-2">
              {responsavelRanked.map((r, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span>{r.respFiscal}</span><span className="font-medium">{r._count} clientes</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
