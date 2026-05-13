import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { formatCpfCnpj } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { Search, Users, Plus } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

export default async function ClientesMobile({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim();
  const clientes = await prisma.cliente.findMany({
    where: q ? {
      OR: [
        { razaoSocial: { contains: q, mode: "insensitive" } },
        { cpfCnpj: { contains: q } },
        { nomeFantasia: { contains: q, mode: "insensitive" } },
      ],
    } : undefined,
    orderBy: { razaoSocial: "asc" },
    take: 30,
    include: { _count: { select: { cobrancas: { where: { status: { in: ["ABERTO", "ATRASADO"] } } } } } },
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-cestacorp-blue dark:text-primary">Clientes</h1>
        <Link
          href="/clientes/novo"
          aria-label="Novo cliente"
          className="h-10 w-10 rounded-full bg-cestacorp-blue dark:bg-primary text-white flex items-center justify-center shadow active:scale-95 transition"
        >
          <Plus className="h-5 w-5" />
        </Link>
      </div>

      <form className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar cliente…"
          aria-label="Buscar cliente"
          className="w-full h-11 pl-10 pr-4 rounded-full bg-white dark:bg-slate-900 border dark:border-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-cestacorp-blue/30"
        />
      </form>

      {clientes.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? "Sem resultados" : "Nenhum cliente"}
          description={q ? `Nada encontrado para "${q}"` : "Importe a V106 ou cadastre manualmente."}
          cta={q ? undefined : { href: "/clientes/importar", label: "Importar V106" }}
        />
      ) : (
        <ul className="space-y-2">
          {clientes.map((c) => (
            <li key={c.id}>
              <Link
                href={`/clientes/${c.id}`}
                className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 p-3 active:scale-[0.99] transition"
              >
                <Avatar name={c.nomeFantasia ?? c.razaoSocial} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{c.nomeFantasia ?? c.razaoSocial}</p>
                  <p className="text-xs text-muted-foreground font-mono">{formatCpfCnpj(c.cpfCnpj)}</p>
                </div>
                <div className="text-right shrink-0">
                  {c._count.cobrancas > 0 && (
                    <span className="inline-block status-badge status-atraso text-[10px]">
                      {c._count.cobrancas} pend.
                    </span>
                  )}
                  <span className={"block mt-0.5 text-[10px] " + (c.status === "ATIVO" ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground")}>
                    {c.status}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
