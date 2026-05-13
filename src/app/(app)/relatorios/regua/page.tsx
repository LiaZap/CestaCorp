import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { subDays } from "date-fns";

export const dynamic = "force-dynamic";

export default async function RelatorioReguaPage() {
  const ultimos30 = subDays(new Date(), 30);

  const [porStatus, porCanal, taxaEntrega, topErros] = await Promise.all([
    prisma.execucaoRegua.groupBy({
      by: ["status"], _count: true,
      where: { createdAt: { gte: ultimos30 } },
    }),
    prisma.reguaPasso.groupBy({ by: ["canal"], _count: true }),
    prisma.execucaoRegua.aggregate({
      _count: true,
      where: { status: "ENVIADO", createdAt: { gte: ultimos30 } },
    }),
    prisma.execucaoRegua.findMany({
      where: { status: "ERRO", createdAt: { gte: ultimos30 } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { cliente: { select: { razaoSocial: true } }, passo: { select: { nome: true } } },
    }),
  ]);

  const totalExec = porStatus.reduce((a, s) => a + s._count, 0);
  const enviados = porStatus.find((s) => s.status === "ENVIADO")?._count ?? 0;
  const taxa = totalExec ? Math.round((enviados / totalExec) * 100) : 0;

  return (
    <div className="space-y-6">
      <Link href="/relatorios" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Relatórios
      </Link>
      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue">Relatório da Régua</h1>
        <p className="text-muted-foreground">Últimos 30 dias</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Execuções (30 dias)</p>
          <p className="text-2xl font-bold">{totalExec}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Taxa de sucesso</p>
          <p className="text-2xl font-bold text-cestacorp-green">{taxa}%</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Passos ativos</p>
          <p className="text-2xl font-bold">{porCanal.reduce((a, s) => a + s._count, 0)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Distribuição por status</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {porStatus.map((s) => (
              <li key={s.status} className="flex justify-between">
                <span>{s.status}</span><span className="font-medium">{s._count}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimos erros</CardTitle>
          <CardDescription>Investigue para melhorar a taxa de entrega</CardDescription>
        </CardHeader>
        <CardContent>
          {topErros.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum erro nos últimos 30 dias.</p>
          ) : (
            <ul className="divide-y text-sm">
              {topErros.map((e) => (
                <li key={e.id} className="py-2">
                  <Link href={`/regua-cobranca/execucao/${e.id}`} className="hover:underline">
                    <p className="font-medium">{e.cliente.razaoSocial}</p>
                    <p className="text-xs text-muted-foreground">{e.passo.nome}</p>
                    {e.erro && <p className="text-xs text-red-600 mt-0.5 truncate">{e.erro}</p>}
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
