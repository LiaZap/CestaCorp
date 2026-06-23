import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_VIS: Record<string, { label: string; cor: string }> = {
  PENDENTE: { label: "Pendente", cor: "bg-amber-100 text-amber-800" },
  ATRASADO: { label: "Atrasado", cor: "bg-red-100 text-red-800" },
  CONCLUIDO: { label: "Concluído", cor: "bg-emerald-100 text-emerald-800" },
  ISENTO: { label: "Isento", cor: "bg-slate-100 text-slate-700" },
  CANCELADO: { label: "Cancelado", cor: "bg-slate-50 text-slate-500 line-through" },
};

export default async function PortalAgendaPage() {
  const session = await auth();
  const u = session!.user as any;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const ate = new Date(hoje);
  ate.setMonth(ate.getMonth() + 3);

  const eventos = await prisma.eventoAgenda.findMany({
    where: {
      clienteId: u.clienteId,
      deletedAt: null,
      dataVencimento: { gte: hoje, lte: ate },
      status: { in: ["PENDENTE", "ATRASADO"] },
    },
    include: { obrigacao: { select: { tipo: true, nome: true } } },
    orderBy: { dataVencimento: "asc" },
    take: 100,
  });

  // Group by month
  const porMes = new Map<string, typeof eventos>();
  for (const e of eventos) {
    const k = `${e.dataVencimento.getFullYear()}-${String(e.dataVencimento.getMonth() + 1).padStart(2, "0")}`;
    if (!porMes.has(k)) porMes.set(k, []);
    porMes.get(k)!.push(e);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <Calendar className="h-7 w-7" /> Minha agenda
        </h1>
        <p className="text-muted-foreground">
          Próximos vencimentos e obrigações dos próximos 90 dias.
          Clique em "Adicionar à minha agenda" pra importar no Google Calendar / Outlook.
        </p>
      </div>

      {eventos.length === 0 ? (
        <Card>
          <CardContent className="pt-8 pb-8 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-2" />
            Sem vencimentos pendentes nos próximos 90 dias 🎉
          </CardContent>
        </Card>
      ) : (
        Array.from(porMes.entries()).map(([mes, lista]) => {
          const [ano, m] = mes.split("-");
          const nomeMes = new Date(Number(ano), Number(m) - 1, 1).toLocaleDateString("pt-BR", {
            month: "long", year: "numeric",
          });
          return (
            <Card key={mes}>
              <CardHeader>
                <CardTitle className="capitalize">{nomeMes}</CardTitle>
                <CardDescription>{lista.length} vencimento(s)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {lista.map((e) => {
                  const vis = STATUS_VIS[e.status] ?? STATUS_VIS.PENDENTE;
                  const passou = new Date(e.dataVencimento) < hoje;
                  return (
                    <div key={e.id} className="border rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`shrink-0 text-center px-3 py-1.5 rounded-md ${passou ? "bg-red-50" : "bg-muted"}`}>
                          <div className="text-[10px] uppercase text-muted-foreground">
                            {e.dataVencimento.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                          </div>
                          <div className="text-xl font-bold leading-none">{e.dataVencimento.getDate()}</div>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {e.obrigacao?.tipo && (
                              <span className="text-[10px] font-bold bg-cestacorp-blue/10 text-cestacorp-blue px-1.5 py-0.5 rounded">
                                {e.obrigacao.tipo}
                              </span>
                            )}
                            <span className="font-medium">{e.titulo}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${vis.cor}`}>{vis.label}</span>
                            <span className="text-xs text-muted-foreground">{formatDate(e.dataVencimento)}</span>
                          </div>
                        </div>
                      </div>
                      <Button asChild size="sm" variant="outline">
                        <a href={`/api/agenda/eventos/${e.id}/ics`} download>
                          <Download className="h-3 w-3" /> Adicionar à minha agenda (.ics)
                        </a>
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-4 w-4" /> Importante
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1.5">
          <p>• Estes são lembretes informativos. Se você já pagou/cumpriu, ignore este aviso.</p>
          <p>• A Cestacorp também vai te lembrar via WhatsApp com antecedência.</p>
          <p>• Em caso de dúvida sobre algum vencimento, fale com seu responsável.</p>
        </CardContent>
      </Card>
    </div>
  );
}
