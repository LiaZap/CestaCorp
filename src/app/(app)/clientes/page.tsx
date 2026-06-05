import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Upload, Search, ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { formatCpfCnpj } from "@/lib/utils";
import { contarAtrasadasPorCliente } from "@/lib/services/inadimplencia";
import { BolinhaAtraso } from "@/components/BolinhaAtraso";

export const dynamic = "force-dynamic";

const POR_PAGINA = 25;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: { q?: string; pagina?: string; status?: string };
}) {
  const q = searchParams.q?.trim();
  const pagina = Math.max(1, Number(searchParams.pagina ?? "1") || 1);
  const status = searchParams.status;

  const where = {
    ...(q
      ? {
          OR: [
            { razaoSocial: { contains: q, mode: "insensitive" as const } },
            { cpfCnpj: { contains: q } },
            { nomeFantasia: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status && status !== "TODOS" ? { status: status as any } : {}),
  };

  const [clientes, total] = await Promise.all([
    prisma.cliente.findMany({
      where,
      orderBy: { razaoSocial: "asc" },
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
      include: { _count: { select: { contratos: true, cobrancas: true } } },
    }),
    prisma.cliente.count({ where }),
  ]);

  // Bolinha de inadimplência (Patrick call 18/05) — 1 query agregada
  const inadimplenciaMap = await contarAtrasadasPorCliente(clientes.map((c) => c.id));

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  function buildLink(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status && status !== "TODOS") params.set("status", status);
    if (p > 1) params.set("pagina", String(p));
    const qs = params.toString();
    return "/clientes" + (qs ? `?${qs}` : "");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-cestacorp-blue">Clientes</h1>
          <p className="text-muted-foreground">
            {total.toLocaleString("pt-BR")} {total === 1 ? "cliente" : "clientes"}
            {q && ` · buscando "${q}"`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild>
            <Link href="/clientes/pre-cadastros">
              <UserPlus className="h-4 w-4" />
              Pré-cadastros
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/clientes/importar">
              <Upload className="h-4 w-4" />
              Importar V106
            </Link>
          </Button>
          <Button asChild>
            <Link href="/clientes/novo">
              <Plus className="h-4 w-4" />
              Novo cliente
            </Link>
          </Button>
        </div>
      </div>

      <form className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input name="q" defaultValue={q} placeholder="Buscar por razão social, fantasia ou CNPJ…" className="pl-10" />
        </div>
        <select
          name="status"
          defaultValue={status ?? "TODOS"}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="TODOS">Todos os status</option>
          <option value="ATIVO">Ativos</option>
          <option value="EM_ATRASO">Em atraso</option>
          <option value="SUSPENSO">Suspensos</option>
          <option value="ENCERRADO">Encerrados</option>
        </select>
        <Button variant="secondary" type="submit">Buscar</Button>
        {(q || (status && status !== "TODOS")) && (
          <Button variant="ghost" asChild>
            <Link href="/clientes">Limpar</Link>
          </Button>
        )}
      </form>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">
            Página {pagina} de {totalPaginas}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Exibindo {clientes.length} de {total.toLocaleString("pt-BR")}
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Código</th>
                <th className="py-2 pr-3">Razão social</th>
                <th className="py-2 pr-3">CPF/CNPJ</th>
                <th className="py-2 pr-3">Classif.</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3 text-right">Contratos</th>
                <th className="py-2 pr-3 text-right">Cobranças</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => {
                const qtdAtrasadas = inadimplenciaMap.get(c.id) ?? 0;
                return (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2 pr-3">{c.codigo ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-2">
                        <BolinhaAtraso qtd={qtdAtrasadas} />
                        <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">
                          {c.razaoSocial}
                        </Link>
                      </span>
                      {c.nomeFantasia && c.nomeFantasia !== c.razaoSocial && (
                        <p className="text-[11px] text-muted-foreground">{c.nomeFantasia}</p>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{formatCpfCnpj(c.cpfCnpj)}</td>
                    <td className="py-2 pr-3">{c.classificacao ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <span className={"status-badge " + (c.status === "ATIVO" ? "status-ativo" : "status-aberto")}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right">{c._count.contratos}</td>
                    <td className="py-2 pr-3 text-right">{c._count.cobrancas}</td>
                  </tr>
                );
              })}
              {clientes.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    Nenhum cliente encontrado.{" "}
                    <Link href="/clientes/importar" className="text-primary hover:underline">
                      Importar da V106
                    </Link>
                    .
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
        {totalPaginas > 1 && (
          <div className="border-t px-6 py-3 flex items-center justify-between">
            <Button variant="ghost" size="sm" asChild disabled={pagina <= 1}>
              <Link href={buildLink(Math.max(1, pagina - 1))} aria-disabled={pagina <= 1}>
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Link>
            </Button>
            <div className="flex items-center gap-1 text-sm">
              {gerarPaginas(pagina, totalPaginas).map((p, i) =>
                typeof p === "number" ? (
                  <Link
                    key={i}
                    href={buildLink(p)}
                    className={
                      "px-3 py-1 rounded-md transition " +
                      (p === pagina
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "hover:bg-muted")
                    }
                  >
                    {p}
                  </Link>
                ) : (
                  <span key={i} className="px-1 text-muted-foreground">…</span>
                )
              )}
            </div>
            <Button variant="ghost" size="sm" asChild disabled={pagina >= totalPaginas}>
              <Link href={buildLink(Math.min(totalPaginas, pagina + 1))} aria-disabled={pagina >= totalPaginas}>
                Próxima <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * Gera array de páginas com ellipsis: [1, "...", 4, 5, 6, "...", 20]
 */
function gerarPaginas(atual: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const paginas: (number | "...")[] = [1];
  if (atual > 3) paginas.push("...");
  const inicio = Math.max(2, atual - 1);
  const fim = Math.min(total - 1, atual + 1);
  for (let p = inicio; p <= fim; p++) paginas.push(p);
  if (atual < total - 2) paginas.push("...");
  paginas.push(total);
  return paginas;
}
