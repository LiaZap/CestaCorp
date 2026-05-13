import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ContratosPage() {
  const contratos = await prisma.contrato.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: { cliente: { select: { razaoSocial: true, cpfCnpj: true } } },
  });
  const templates = await prisma.contratoTemplate.findMany({ where: { ativo: true } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-cestacorp-blue">Contratos</h1>
          <p className="text-muted-foreground">Geração automática com 1 clique a partir de templates</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button asChild>
            <Link href="/contratos/lote-lgpd">Lote LGPD</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/contratos/lote">Lote simples</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contratos/templates/anexos">Anexos</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contratos/templates">Templates</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Templates ativos ({templates.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum template cadastrado. Faça o upload de um .docx com placeholders em /contratos/templates.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {templates.map((t) => (
                <li key={t.id} className="flex justify-between items-center p-2 rounded hover:bg-muted">
                  <span><b>{t.nome}</b> <span className="text-muted-foreground">· {t.tipo}</span></span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contratos gerados</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Número</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Valor</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Emitido em</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{c.numero ?? c.id.slice(0, 8)}</td>
                  <td className="py-2 pr-3">{c.cliente.razaoSocial}</td>
                  <td className="py-2 pr-3">{c.tipo}</td>
                  <td className="py-2 pr-3">{formatMoney(Number(c.valorHonorarios))}</td>
                  <td className="py-2 pr-3"><span className="status-badge status-aberto">{c.status}</span></td>
                  <td className="py-2 pr-3">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
              {contratos.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Nenhum contrato gerado ainda.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
