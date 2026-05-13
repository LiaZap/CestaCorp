import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RelatorioTagsPage() {
  const tags = await prisma.tag.findMany({
    include: { _count: { select: { clientes: true, textos: true } } },
    orderBy: { nome: "asc" },
  });

  const totalClientes = await prisma.cliente.count();
  const clientesComTag = await prisma.cliente.count({ where: { tags: { some: {} } } });
  const ranked = [...tags].sort((a, b) => b._count.clientes - a._count.clientes);
  const maxUso = Math.max(1, ...ranked.map((t) => t._count.clientes));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/relatorios" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Relatórios
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3 mt-2">
          <div>
            <h1 className="text-3xl font-bold text-cestacorp-blue">Relatório de Tags</h1>
            <p className="text-muted-foreground">Uso por cliente, ranking e export</p>
          </div>
          <Button asChild variant="outline">
            <a href="/api/relatorios/tags.csv">
              <Download className="h-4 w-4" /> Baixar CSV
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Tags cadastradas</p>
          <p className="text-2xl font-bold">{tags.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Clientes com tag</p>
          <p className="text-2xl font-bold">{clientesComTag} <span className="text-sm text-muted-foreground">/ {totalClientes}</span></p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Cobertura</p>
          <p className="text-2xl font-bold">
            {totalClientes ? Math.round((clientesComTag / totalClientes) * 100) : 0}%
          </p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ranking por uso</CardTitle>
          <CardDescription>Quantidade de clientes associados a cada tag</CardDescription>
        </CardHeader>
        <CardContent>
          {ranked.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma tag ainda. <Link href="/tags" className="text-primary hover:underline">Sincronizar com Digisac</Link>.
            </p>
          ) : (
            <ul className="space-y-2">
              {ranked.map((t) => {
                const pct = (t._count.clientes / maxUso) * 100;
                return (
                  <li key={t.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ background: t.cor ?? "#84CC16" }} />
                        <span className="font-medium truncate">{t.nome}</span>
                        <span className="text-xs text-muted-foreground">· {t.origem ?? "interno"}</span>
                      </div>
                      <span className="text-sm font-mono tabular-nums">{t._count.clientes} clientes</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, background: t.cor ?? "#84CC16" }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
