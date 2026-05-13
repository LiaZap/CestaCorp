import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";
import { Calendar, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default async function AgendaMobile() {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const em30 = new Date(hoje); em30.setDate(hoje.getDate() + 30);

  const eventos = await prisma.eventoAgenda.findMany({
    where: {
      dataVencimento: { gte: hoje, lte: em30 },
      status: { in: ["PENDENTE", "ATRASADO"] },
    },
    orderBy: { dataVencimento: "asc" },
    take: 40,
    include: {
      cliente: { select: { razaoSocial: true, nomeFantasia: true } },
      obrigacao: { select: { tipo: true } },
    },
  });

  // Agrupa por data
  const grupos = new Map<string, typeof eventos>();
  for (const e of eventos) {
    const key = e.dataVencimento.toISOString().slice(0, 10);
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(e);
  }

  const resumo = await prisma.eventoAgenda.groupBy({
    by: ["status"],
    _count: true,
    where: { dataVencimento: { gte: hoje, lte: em30 } },
  });
  const byStatus = Object.fromEntries(resumo.map((r) => [r.status, r._count]));

  return (
    <>
      <h1 className="text-2xl font-bold text-cestacorp-blue dark:text-primary">Agenda</h1>

      <div className="grid grid-cols-3 gap-2">
        <MiniKpi label="Pendentes" value={byStatus.PENDENTE ?? 0} color="amber" icon={Clock} />
        <MiniKpi label="Atrasados" value={byStatus.ATRASADO ?? 0} color="red" icon={AlertTriangle} />
        <MiniKpi label="Concluídos" value={byStatus.CONCLUIDO ?? 0} color="emerald" icon={CheckCircle2} />
      </div>

      {grupos.size === 0 ? (
        <EmptyState icon={Calendar} title="Nada nos próximos 30 dias 🎉" />
      ) : (
        <div className="space-y-4">
          {Array.from(grupos.entries()).map(([dia, items]) => {
            const dt = new Date(dia);
            const isHoje = dt.getTime() === hoje.getTime();
            const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1);
            const isAmanha = dt.getTime() === amanha.getTime();
            const label = isHoje ? "HOJE" : isAmanha ? "AMANHÃ" : DIAS[dt.getDay()].toUpperCase();

            return (
              <section key={dia}>
                <div className="flex items-baseline gap-2 mb-2 sticky top-14 bg-gradient-to-b from-slate-50 dark:from-slate-900 pt-2 -mt-2 pb-1 z-10">
                  <span className={
                    "text-2xl font-bold leading-none " +
                    (isHoje ? "text-cestacorp-blue dark:text-primary" : "")
                  }>
                    {dt.getDate()}
                  </span>
                  <span className="text-xs uppercase text-muted-foreground tracking-wider">
                    {MESES[dt.getMonth()]} · {label}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {items.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/agenda/${e.id}`}
                        className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 p-3 active:scale-[0.99] transition"
                      >
                        <div className={
                          "h-2 w-2 rounded-full shrink-0 " +
                          (e.status === "ATRASADO" ? "bg-red-500" : "bg-amber-500")
                        } />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {e.obrigacao?.tipo && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded mr-2">{e.obrigacao.tipo}</span>}
                            {e.titulo}
                          </p>
                          {e.cliente && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                              {e.cliente.nomeFantasia ?? e.cliente.razaoSocial}
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function MiniKpi({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: "emerald" | "amber" | "red" }) {
  const classes = {
    emerald: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
    amber: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
    red: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
  };
  return (
    <div className={"rounded-xl p-3 text-center " + classes[color]}>
      <Icon className="h-4 w-4 mx-auto mb-1" />
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] uppercase font-semibold tracking-wider">{label}</p>
    </div>
  );
}
