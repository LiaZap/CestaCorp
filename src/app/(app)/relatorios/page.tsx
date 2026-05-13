import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tag, Users, FileText, MessageSquareWarning, ArrowRight, BarChart3, TrendingUp, History } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const [
    totalTags,
    totalClientes,
    clientesAtivos,
    cobrancas,
    cobrancasAbertas,
    execucoes,
    execucoesEnviadas,
  ] = await Promise.all([
    prisma.tag.count(),
    prisma.cliente.count(),
    prisma.cliente.count({ where: { status: "ATIVO" } }),
    prisma.cobranca.aggregate({ _count: true, _sum: { valor: true } }),
    prisma.cobranca.count({ where: { status: "ABERTO" } }),
    prisma.execucaoRegua.count(),
    prisma.execucaoRegua.count({ where: { status: "ENVIADO" } }),
  ]);

  const taxaEntrega = execucoes > 0 ? ((execucoesEnviadas / execucoes) * 100).toFixed(1) : "0";
  const valorTotal = Number(cobrancas._sum.valor ?? 0);

  // Movimentação do mês corrente
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const [entradasMes, saidasMes] = await Promise.all([
    prisma.cliente.count({ where: { inicio: { gte: inicioMes } } }),
    prisma.cliente.count({ where: { status: "ENCERRADO", updatedAt: { gte: inicioMes } } }),
  ]);
  const saldoMes = entradasMes - saidasMes;

  const relatorios = [
    {
      href: "/relatorios/movimentacao",
      icon: TrendingUp,
      title: "Movimentação",
      desc: "Entradas e saídas por mês — reunião dia 4",
      stat: `${saldoMes >= 0 ? "+" : ""}${saldoMes}`,
      statLabel: `${entradasMes} entrou · ${saidasMes} saiu`,
      color: "from-emerald-500 to-teal-600",
      destaque: true,
    },
    {
      href: "/relatorios/historico",
      icon: History,
      title: "Histórico anual",
      desc: "Evolução por mês, segmento e categoria",
      stat: hoje.getFullYear().toString(),
      statLabel: "ano atual",
      color: "from-indigo-500 to-blue-700",
    },
    {
      href: "/relatorios/tags",
      icon: Tag,
      title: "Tags",
      desc: "Ranking de uso e segmentação",
      stat: totalTags.toString(),
      statLabel: "tags cadastradas",
      color: "from-violet-500 to-purple-600",
    },
    {
      href: "/relatorios/clientes",
      icon: Users,
      title: "Clientes",
      desc: "Por status, classificação, responsável",
      stat: `${clientesAtivos}/${totalClientes}`,
      statLabel: "ativos / total",
      color: "from-emerald-500 to-emerald-700",
    },
    {
      href: "/relatorios/cobrancas",
      icon: FileText,
      title: "Cobranças",
      desc: "Aberto/pago/atrasado por período",
      stat: formatMoney(valorTotal),
      statLabel: `${cobrancasAbertas} em aberto`,
      color: "from-amber-500 to-orange-600",
    },
    {
      href: "/relatorios/regua",
      icon: MessageSquareWarning,
      title: "Régua",
      desc: "Taxa de entrega, atraso, conversão",
      stat: `${taxaEntrega}%`,
      statLabel: "taxa de entrega",
      color: "from-cestacorp-blue to-blue-700",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <BarChart3 className="h-7 w-7" /> Relatórios
        </h1>
        <p className="text-muted-foreground">Exportações e análises cruzadas · dados em tempo real</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {relatorios.map((r) => (
          <Link key={r.href} href={r.href} className="group">
            <Card className="hover:shadow-lg hover:-translate-y-0.5 transition cursor-pointer h-full overflow-hidden relative">
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${r.color}`} />
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${r.color} flex items-center justify-center text-white shadow-sm`}>
                    <r.icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-cestacorp-blue group-hover:translate-x-0.5 transition" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-bold tracking-tight">{r.stat}</p>
                <p className="text-[11px] text-muted-foreground mb-3">{r.statLabel}</p>
                <CardTitle className="text-sm">{r.title}</CardTitle>
                <CardDescription className="text-xs mt-0.5">{r.desc}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo geral</CardTitle>
          <CardDescription>Snapshot da operação agora</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider">Cobranças emitidas</p>
              <p className="text-xl font-bold mt-1">{cobrancas._count}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider">Mensagens enviadas</p>
              <p className="text-xl font-bold mt-1">{execucoesEnviadas.toLocaleString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider">Taxa de sucesso</p>
              <p className="text-xl font-bold mt-1 text-emerald-600">{taxaEntrega}%</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider">Clientes ativos</p>
              <p className="text-xl font-bold mt-1">{clientesAtivos}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
