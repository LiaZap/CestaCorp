import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/DataTable";
import { Paginacao } from "@/components/Paginacao";
import Link from "next/link";
import { Search } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const STATUS_VALIDOS = ["TODOS", "RASCUNHO", "EMITIDO", "ASSINADO", "ENCERRADO", "CANCELADO"] as const;
type StatusFilter = (typeof STATUS_VALIDOS)[number];

export default async function ContratosPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; status?: string };
}) {
  // Filtros server-side (#80)
  const q = (searchParams.q ?? "").trim();
  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const status = (STATUS_VALIDOS.includes(searchParams.status as StatusFilter)
    ? searchParams.status
    : "TODOS") as StatusFilter;

  const where: any = {};
  if (status !== "TODOS") where.status = status;
  if (q) {
    const digits = q.replace(/\D/g, "");
    where.OR = [
      { numero: { contains: q, mode: "insensitive" } },
      { cliente: { is: { razaoSocial: { contains: q, mode: "insensitive" } } } },
      ...(digits ? [{ cliente: { is: { cpfCnpj: { contains: digits } } } }] : []),
    ];
  }

  const [contratos, total, templates] = await Promise.all([
    prisma.contrato.findMany({
      where,
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      orderBy: { createdAt: "desc" },
      include: { cliente: { select: { razaoSocial: true, cpfCnpj: true } } },
    }),
    prisma.contrato.count({ where }),
    prisma.contratoTemplate.findMany({ where: { ativo: true } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
          {/* Form GET — URL reflete filtros pra ser bookmarkable */}
          <form className="mt-3 flex flex-wrap gap-2 items-end" action="/contratos" method="get">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">Buscar</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  name="q"
                  defaultValue={q}
                  placeholder="Número, cliente ou CNPJ"
                  className="pl-8"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                name="status"
                defaultValue={status}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="TODOS">Todos</option>
                <option value="RASCUNHO">Rascunho</option>
                <option value="EMITIDO">Emitido</option>
                <option value="ASSINADO">Assinado</option>
                <option value="ENCERRADO">Encerrado</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>
            <Button type="submit" variant="outline" size="sm">Filtrar</Button>
            {(q || status !== "TODOS") && (
              <Button asChild type="button" variant="ghost" size="sm">
                <Link href="/contratos">Limpar</Link>
              </Button>
            )}
          </form>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={contratos}
            rowKey={(c) => c.id}
            empty={q || status !== "TODOS" ? "Nenhum contrato bate com o filtro." : "Nenhum contrato gerado ainda."}
            columns={[
              { key: "numero", label: "Número", render: (c) => c.numero ?? c.id.slice(0, 8) },
              { key: "cliente", label: "Cliente", render: (c) => c.cliente.razaoSocial },
              { key: "tipo", label: "Tipo", render: (c) => c.tipo },
              { key: "valor", label: "Valor", align: "right", render: (c) => formatMoney(Number(c.valorHonorarios)) },
              {
                key: "status",
                label: "Status",
                render: (c) => <span className="status-badge status-aberto">{c.status}</span>,
              },
              { key: "criado", label: "Emitido em", render: (c) => formatDate(c.createdAt) },
            ]}
            footer={
              <Paginacao
                page={page}
                totalPages={totalPages}
                baseHref="/contratos"
                preserve={{ q: q || undefined, status: status !== "TODOS" ? status : undefined }}
                total={total}
              />
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
