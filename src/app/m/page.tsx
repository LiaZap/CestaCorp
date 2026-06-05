import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/utils";
import {
  AlertCircle, ArrowRight, CreditCard, TrendingUp, MessageSquare,
  CheckCircle2, Clock, Beaker, Megaphone, Users,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function MobileHome() {
  const session = await auth();
  const nome = (session?.user?.name ?? "").split(" ")[0] || "olá";

  const [atrasadas, abertas, valorAberto, pagoMes, execucoesHoje] = await Promise.all([
    prisma.cobranca.count({ where: { status: "ATRASADO" } }),
    prisma.cobranca.count({ where: { status: { in: ["ABERTO", "ATRASADO"] } } }),
    prisma.cobranca.aggregate({
      _sum: { valor: true },
      where: { status: { in: ["ABERTO", "ATRASADO"] } },
    }),
    prisma.cobranca.aggregate({
      _sum: { valor: true },
      where: { status: "PAGO", dataPagamento: { gte: new Date(new Date().setDate(1)) } },
    }),
    prisma.execucaoRegua.count({
      where: {
        status: "ENVIADO",
        enviadoEm: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ]);

  const proximas = await prisma.cobranca.findMany({
    where: { status: { in: ["ABERTO", "ATRASADO"] } },
    orderBy: { vencimento: "asc" },
    take: 3,
    include: { cliente: { select: { razaoSocial: true, nomeFantasia: true, id: true } } },
  });

  const hora = new Date().getHours();
  const saudacao = hora < 6 ? "Boa madrugada" : hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return (
    <>
      {/* Saudação */}
      <section>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{saudacao}</p>
        <h1 className="text-2xl font-bold text-cestacorp-blue dark:text-primary">
          {nome}! 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Aqui está sua operação hoje.</p>
      </section>

      {/* Card hero: valor em aberto */}
      <Link
        href="/m/cobrancas"
        className="block rounded-2xl bg-gradient-to-br from-cestacorp-blue via-indigo-700 to-cestacorp-green text-white p-5 shadow-lg active:scale-[0.99] transition"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase opacity-80 tracking-wider">Total a receber</p>
            <p className="text-3xl font-bold mt-1">
              {formatMoney(Number(valorAberto._sum.valor ?? 0))}
            </p>
          </div>
          <ArrowRight className="h-5 w-5 opacity-70" />
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 bg-white/15 px-2.5 py-1 rounded-full backdrop-blur">
            <AlertCircle className="h-3 w-3" /> {atrasadas} atrasadas
          </span>
          <span className="inline-flex items-center gap-1 bg-white/15 px-2.5 py-1 rounded-full backdrop-blur">
            <Clock className="h-3 w-3" /> {abertas} em aberto
          </span>
        </div>
      </Link>

      {/* Mini KPIs */}
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Pago no mês</p>
            <CheckCircle2 className="h-4 w-4 text-cestacorp-green" />
          </div>
          <p className="text-xl font-bold mt-1.5 text-cestacorp-green">
            {formatMoney(Number(pagoMes._sum.valor ?? 0))}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Msg hoje</p>
            <MessageSquare className="h-4 w-4 text-cestacorp-blue dark:text-primary" />
          </div>
          <p className="text-xl font-bold mt-1.5 text-cestacorp-blue dark:text-primary">{execucoesHoje}</p>
        </div>
      </section>

      {/* Ações rápidas */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ações rápidas</h2>
        <div className="grid grid-cols-4 gap-2">
          <QuickAction href="/regua-cobranca/simular" icon={Beaker} label="Simular" color="violet" />
          <QuickAction href="/regua-cobranca/lote" icon={Megaphone} label="Enviar" color="emerald" />
          <QuickAction href="/m/clientes" icon={Users} label="Clientes" color="blue" />
          <QuickAction href="/reajustes" icon={TrendingUp} label="Reajuste" color="amber" />
        </div>
      </section>

      {/* Próximas cobranças */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Próximas cobranças</h2>
          <Link href="/m/cobrancas" className="text-xs text-cestacorp-blue dark:text-primary hover:underline">ver todas</Link>
        </div>
        {proximas.length === 0 ? (
          <div className="rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 p-6 text-center text-sm text-muted-foreground">
            Nada urgente 🎉
          </div>
        ) : (
          <ul className="space-y-2">
            {proximas.map((c) => {
              const atraso = Math.floor((Date.now() - c.vencimento.getTime()) / 86400000);
              return (
                <li key={c.id}>
                  <Link
                    href={`/m/cobrancas/${c.id}`}
                    className="flex items-center gap-3 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 p-3 active:scale-[0.99] transition"
                  >
                    <div className={
                      "h-10 w-10 rounded-full flex items-center justify-center shrink-0 " +
                      (c.status === "ATRASADO"
                        ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                        : "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300")
                    }>
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {c.cliente.nomeFantasia ?? c.cliente.razaoSocial}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.status === "ATRASADO" && atraso > 0
                          ? `${atraso}d em atraso`
                          : `Vence ${c.vencimento.toLocaleDateString("pt-BR")}`}
                      </p>
                    </div>
                    <p className="text-sm font-bold whitespace-nowrap">{formatMoney(Number(c.valor))}</p>
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

function QuickAction({
  href, icon: Icon, label, color,
}: {
  href: string; icon: any; label: string;
  color: "violet" | "emerald" | "blue" | "amber";
}) {
  const colors = {
    violet: "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300",
    emerald: "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
    blue: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
    amber: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  };
  return (
    <Link href={href} className="flex flex-col items-center gap-1 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 p-3 active:scale-[0.96] transition">
      <div className={"h-10 w-10 rounded-full flex items-center justify-center " + colors[color]}>
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-[11px] font-medium text-center">{label}</span>
    </Link>
  );
}
