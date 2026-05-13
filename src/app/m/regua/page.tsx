import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { formatMoney, formatDateTime } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, Clock, MessageSquare, Beaker, Megaphone } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

const statusDot: Record<string, string> = {
  ENVIADO: "bg-emerald-500",
  PENDENTE: "bg-amber-500",
  ERRO: "bg-red-500",
  PULADO: "bg-slate-400",
  CANCELADO: "bg-slate-400",
};

const statusIcon: Record<string, any> = {
  ENVIADO: CheckCircle2,
  PENDENTE: Clock,
  ERRO: AlertTriangle,
};

export default async function ReguaMobile() {
  const [resumo, recentes] = await Promise.all([
    prisma.execucaoRegua.groupBy({ by: ["status"], _count: true }),
    prisma.execucaoRegua.findMany({
      take: 20,
      orderBy: [{ status: "asc" }, { agendadoPara: "desc" }],
      include: {
        cliente: { select: { razaoSocial: true, nomeFantasia: true } },
        passo: { select: { nome: true, canal: true } },
        cobranca: { select: { valor: true } },
      },
    }),
  ]);

  const byStatus = Object.fromEntries(resumo.map((r) => [r.status, r._count]));

  return (
    <>
      <h1 className="text-2xl font-bold text-cestacorp-blue dark:text-primary">Régua</h1>

      <div className="grid grid-cols-3 gap-2">
        <KPI label="Enviadas" value={byStatus.ENVIADO ?? 0} icon={CheckCircle2} color="emerald" />
        <KPI label="Pendentes" value={byStatus.PENDENTE ?? 0} icon={Clock} color="amber" />
        <KPI label="Erros" value={byStatus.ERRO ?? 0} icon={AlertTriangle} color="red" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/regua-cobranca/simular"
          className="rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white p-4 active:scale-[0.98] transition"
        >
          <Beaker className="h-5 w-5 mb-2" />
          <p className="text-sm font-semibold">Simular</p>
          <p className="text-[11px] opacity-80">Testar com cliente real</p>
        </Link>
        <Link
          href="/regua-cobranca/lote"
          className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-4 active:scale-[0.98] transition"
        >
          <Megaphone className="h-5 w-5 mb-2" />
          <p className="text-sm font-semibold">Enviar lote</p>
          <p className="text-[11px] opacity-80">N clientes de uma vez</p>
        </Link>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Últimas execuções</h2>
        {recentes.length === 0 ? (
          <EmptyState icon={MessageSquare} title="Sem execuções ainda" />
        ) : (
          <ul className="space-y-2">
            {recentes.map((e) => {
              const Icon = statusIcon[e.status] ?? Clock;
              return (
                <li key={e.id}>
                  <Link
                    href={`/regua-cobranca/execucao/${e.id}`}
                    className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 p-3 active:scale-[0.99] transition"
                  >
                    <div className="relative shrink-0">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className={"absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 " + statusDot[e.status]} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {e.cliente.nomeFantasia ?? e.cliente.razaoSocial}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {e.passo.nome} · {formatDateTime(e.agendadoPara)}
                      </p>
                    </div>
                    {e.cobranca?.valor && (
                      <p className="text-xs font-semibold whitespace-nowrap">
                        {formatMoney(Number(e.cobranca.valor))}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function KPI({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: "emerald" | "amber" | "red" }) {
  const classes = {
    emerald: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
    amber: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
    red: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
  };
  return (
    <div className={"rounded-xl p-3 " + classes[color]}>
      <Icon className="h-4 w-4 mb-1" />
      <p className="text-2xl font-bold leading-none">{value}</p>
      <p className="text-[10px] uppercase font-semibold tracking-wider mt-1">{label}</p>
    </div>
  );
}
