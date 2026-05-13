import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { formatMoney, formatDate } from "@/lib/utils";
import { AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { CreditCard } from "lucide-react";

export const dynamic = "force-dynamic";

type Filtro = "atrasado" | "aberto" | "pago" | "todas";

export default async function CobrancasMobile({ searchParams }: { searchParams: { f?: string } }) {
  const f = (searchParams.f as Filtro) ?? "atrasado";
  const where =
    f === "atrasado" ? { status: "ATRASADO" as const }
    : f === "aberto" ? { status: "ABERTO" as const }
    : f === "pago" ? { status: "PAGO" as const }
    : {};

  const cobrancas = await prisma.cobranca.findMany({
    where,
    orderBy: f === "pago" ? { dataPagamento: "desc" } : { vencimento: "asc" },
    take: 40,
    include: { cliente: { select: { razaoSocial: true, nomeFantasia: true, id: true } } },
  });

  const totais = await prisma.cobranca.groupBy({
    by: ["status"],
    _count: true,
    _sum: { valor: true },
  });
  const byStatus = Object.fromEntries(totais.map((t) => [t.status, t]));

  const pills: { key: Filtro; label: string; count: number }[] = [
    { key: "atrasado", label: "Atrasadas", count: byStatus.ATRASADO?._count ?? 0 },
    { key: "aberto", label: "Abertas", count: byStatus.ABERTO?._count ?? 0 },
    { key: "pago", label: "Pagas", count: byStatus.PAGO?._count ?? 0 },
    { key: "todas", label: "Todas", count: totais.reduce((a, t) => a + t._count, 0) },
  ];

  return (
    <>
      <h1 className="text-2xl font-bold text-cestacorp-blue dark:text-primary">Cobranças</h1>

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 no-scrollbar">
        {pills.map((p) => {
          const active = f === p.key;
          return (
            <Link
              key={p.key}
              href={`/m/cobrancas?f=${p.key}`}
              className={
                "shrink-0 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium border transition " +
                (active
                  ? "bg-cestacorp-blue dark:bg-primary text-white border-cestacorp-blue dark:border-primary"
                  : "bg-white dark:bg-slate-900 dark:border-slate-800 hover:border-cestacorp-blue/40")
              }
            >
              {p.label}
              <span className={"text-[10px] font-bold rounded-full px-1.5 " + (active ? "bg-white/25" : "bg-muted")}>{p.count}</span>
            </Link>
          );
        })}
      </div>

      {cobrancas.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={f === "atrasado" ? "Nenhuma cobrança atrasada 🎉" : "Nada por aqui ainda"}
        />
      ) : (
        <ul className="space-y-2">
          {cobrancas.map((c) => {
            const atrasoDias = Math.floor((Date.now() - c.vencimento.getTime()) / 86400000);
            return (
              <li key={c.id}>
                <Link
                  href={`/cobrancas/${c.id}`}
                  className="block rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 p-4 active:scale-[0.99] transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">
                        {c.cliente.nomeFantasia ?? c.cliente.razaoSocial}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.descricao ?? "Honorários"}</p>
                    </div>
                    <p className="text-base font-bold whitespace-nowrap">{formatMoney(Number(c.valor))}</p>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {c.status === "PAGO" ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Pago em {formatDate(c.dataPagamento)}
                      </span>
                    ) : c.status === "ATRASADO" ? (
                      <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400">
                        <AlertCircle className="h-3 w-3" />
                        {atrasoDias}d em atraso
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                        <Clock className="h-3 w-3" />
                        Vence {formatDate(c.vencimento)}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
