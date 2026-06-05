import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronLeft, ChevronRight, CreditCard, AlertCircle, Plus } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/utils";
import { CobrancasActions } from "./CobrancasActions";

export const dynamic = "force-dynamic";

const POR_PAGINA = 30;

type SP = {
  status?: string;          // ABERTO | ATRASADO | PAGO | CANCELADO | PARCIAL | TODOS
  vencFrom?: string;        // YYYY-MM-DD
  vencTo?: string;          // YYYY-MM-DD
  cliente?: string;         // busca razão/fantasia/cnpj
  classificacao?: string;   // BRONZE | PRATA | OURO | TOP | TODOS
  pagina?: string;
};

export default async function CobrancasPage({ searchParams }: { searchParams: SP }) {
  const status = searchParams.status?.trim();
  const vencFrom = searchParams.vencFrom?.trim();
  const vencTo = searchParams.vencTo?.trim();
  const cliente = searchParams.cliente?.trim();
  const classificacao = searchParams.classificacao?.trim();
  const pagina = Math.max(1, Number(searchParams.pagina ?? "1") || 1);

  const where: any = {};

  if (status && status !== "TODOS") {
    where.status = status;
  }

  if (vencFrom || vencTo) {
    where.vencimento = {};
    if (vencFrom) where.vencimento.gte = new Date(vencFrom + "T00:00:00");
    if (vencTo) where.vencimento.lte = new Date(vencTo + "T23:59:59");
  }

  if (cliente) {
    where.cliente = {
      OR: [
        { razaoSocial: { contains: cliente, mode: "insensitive" } },
        { nomeFantasia: { contains: cliente, mode: "insensitive" } },
        { cpfCnpj: { contains: cliente } },
      ],
    };
  }

  if (classificacao && classificacao !== "TODOS") {
    where.cliente = { ...(where.cliente ?? {}), classificacao };
  }

  const [cobrancas, total, totaisGroup] = await Promise.all([
    prisma.cobranca.findMany({
      where,
      orderBy: [{ status: "asc" }, { vencimento: "asc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: {
        cliente: {
          select: { id: true, razaoSocial: true, nomeFantasia: true, classificacao: true },
        },
      },
    }),
    prisma.cobranca.count({ where }),
    prisma.cobranca.groupBy({
      by: ["status"],
      where,
      _count: true,
      _sum: { valor: true },
    }),
  ]);

  const byStatus = Object.fromEntries(totaisGroup.map((t) => [t.status, t]));
  const valorTotal = totaisGroup.reduce((acc, t) => acc + Number(t._sum.valor ?? 0), 0);
  const valorAberto = Number(byStatus.ABERTO?._sum.valor ?? 0);
  const valorAtrasado = Number(byStatus.ATRASADO?._sum.valor ?? 0);
  const valorPago = Number(byStatus.PAGO?._sum.valor ?? 0);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const baseParams = new URLSearchParams();
  if (status && status !== "TODOS") baseParams.set("status", status);
  if (vencFrom) baseParams.set("vencFrom", vencFrom);
  if (vencTo) baseParams.set("vencTo", vencTo);
  if (cliente) baseParams.set("cliente", cliente);
  if (classificacao && classificacao !== "TODOS") baseParams.set("classificacao", classificacao);
  const baseQs = baseParams.toString();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-cestacorp-blue">Cobranças</h1>
          <p className="text-muted-foreground">
            {total.toLocaleString("pt-BR")} {total === 1 ? "cobrança" : "cobranças"} no filtro atual
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild>
            <Link href="/regua-cobranca/lote">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              Enviar em lote
            </Link>
          </Button>
          <Button asChild>
            <Link href="/clientes">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Lançar cobrança
            </Link>
          </Button>
        </div>
      </div>

      {/* KPIs / totais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="text-2xl font-bold mt-1">{formatMoney(valorTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Em aberto</p>
            <p className="text-2xl font-bold mt-1 text-amber-700">{formatMoney(valorAberto)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Atrasado</p>
            <p className="text-2xl font-bold mt-1 text-red-700">{formatMoney(valorAtrasado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Pago</p>
            <p className="text-2xl font-bold mt-1 text-emerald-700">{formatMoney(valorPago)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <form className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        <div className="relative lg:col-span-2">
          <label htmlFor="filtro-cliente" className="sr-only">Cliente</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id="filtro-cliente"
            name="cliente"
            defaultValue={cliente}
            placeholder="Cliente: razão, fantasia ou CNPJ…"
            className="pl-10"
          />
        </div>
        <div>
          <label htmlFor="filtro-status" className="sr-only">Status</label>
          <select
            id="filtro-status"
            name="status"
            defaultValue={status ?? "TODOS"}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="TODOS">Todos os status</option>
            <option value="ABERTO">Em aberto</option>
            <option value="ATRASADO">Atrasadas</option>
            <option value="PAGO">Pagas</option>
            <option value="PARCIAL">Parcial</option>
            <option value="CANCELADO">Canceladas</option>
          </select>
        </div>
        <div>
          <label htmlFor="filtro-classif" className="sr-only">Classificação</label>
          <select
            id="filtro-classif"
            name="classificacao"
            defaultValue={classificacao ?? "TODOS"}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="TODOS">Toda classificação</option>
            <option value="BRONZE">Bronze</option>
            <option value="PRATA">Prata</option>
            <option value="OURO">Ouro</option>
            <option value="TOP">Top</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:col-span-2">
          <div>
            <label htmlFor="filtro-venc-from" className="text-[11px] uppercase tracking-wider text-muted-foreground">Venc. de</label>
            <Input id="filtro-venc-from" name="vencFrom" type="date" defaultValue={vencFrom} className="text-sm" />
          </div>
          <div>
            <label htmlFor="filtro-venc-to" className="text-[11px] uppercase tracking-wider text-muted-foreground">até</label>
            <Input id="filtro-venc-to" name="vencTo" type="date" defaultValue={vencTo} className="text-sm" />
          </div>
        </div>
        <div className="flex gap-2 col-span-full">
          <Button type="submit" variant="secondary">Aplicar filtros</Button>
          {(status || vencFrom || vencTo || cliente || classificacao) && (
            <Button variant="ghost" asChild>
              <Link href="/cobrancas">Limpar</Link>
            </Button>
          )}
        </div>
      </form>

      {/* Tabela com seleção em lote */}
      <CobrancasActions
        cobrancas={cobrancas.map((c) => ({
          id: c.id,
          descricao: c.descricao,
          valor: Number(c.valor),
          vencimento: c.vencimento.toISOString(),
          dataPagamento: c.dataPagamento?.toISOString() ?? null,
          status: c.status,
          cliente: {
            id: c.cliente.id,
            nome: c.cliente.nomeFantasia ?? c.cliente.razaoSocial,
            classificacao: c.cliente.classificacao,
          },
        }))}
        pagina={pagina}
        totalPaginas={totalPaginas}
        totalRegistros={total}
        baseQs={baseQs}
      />
    </div>
  );
}
