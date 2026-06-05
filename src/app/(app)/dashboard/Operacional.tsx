/**
 * Dashboard Operacional — SEM valores monetários (call 18/05).
 * Foco em "o que eu preciso fazer hoje":
 *   - clientes ativos / em onboarding
 *   - mensagens da régua hoje
 *   - próximas obrigações
 *   - top clientes (sem R$)
 */
import Link from "next/link";
import { Users, Send, FileText, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KpiCard, RestrictedKpi } from "@/components/KpiCard";
import { ReguaStatusChart } from "@/components/charts/ReguaStatusChart";
import { ClassificacaoPie } from "@/components/charts/ClassificacaoPie";
import { FormFunil } from "@/components/charts/FormFunil";
import { formatDate } from "@/lib/utils";

interface Props {
  kpis: {
    clientesAtivos: number;
    clientesTotal: number;
    cobrancasAbertas: number;
    valorEmAberto: number;
    valorAtrasado: number;
    pagoNoMes: number;
    execucoesHoje: number;
    respostasMes: number;
  };
  reguaStatus: any[];
  classif: any[];
  funil: any[];
  proximas: any[];
  dias: number;
}

export function Operacional({ kpis, reguaStatus, classif, funil, proximas, dias }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard
          label="Clientes ativos"
          value={kpis.clientesAtivos}
          sub={`de ${kpis.clientesTotal} no total`}
          icon={Users}
          color="text-cestacorp-blue"
          href="/clientes?status=ATIVO"
        />
        <RestrictedKpi podeVer={false} label="Em aberto" value="—" />
        <RestrictedKpi podeVer={false} label="Em atraso" value="—" />
        <RestrictedKpi podeVer={false} label="Pago no mês" value="—" />
        <KpiCard
          label="Mensagens hoje"
          value={kpis.execucoesHoje}
          sub="enviadas pela régua"
          icon={Send}
          color="text-cestacorp-blue"
          href="/regua-cobranca"
        />
        <KpiCard
          label="Formulários no mês"
          value={kpis.respostasMes}
          sub="novas respostas"
          icon={FileText}
          color="text-purple-600"
          href="/formularios"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Mensagens da Régua — últimos {dias} dias</CardTitle>
            <CardDescription>Volume diário por status</CardDescription>
          </CardHeader>
          <CardContent className="px-2 md:px-6">
            <ReguaStatusChart data={reguaStatus} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Funil de formulários</CardTitle>
            <CardDescription>Status no total</CardDescription>
          </CardHeader>
          <CardContent className="px-2 md:px-6">
            <FormFunil data={funil} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card>
          <CardHeader>
            <CardTitle>
              <Link href="/clientes?status=ATIVO" className="hover:underline">
                Classificação
              </Link>
            </CardTitle>
            <CardDescription>Clientes ativos</CardDescription>
          </CardHeader>
          <CardContent>
            <ClassificacaoPie data={classif} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" /> Próximas cobranças (7 dias)
            </CardTitle>
            <CardDescription>Sem valores (perfil operacional)</CardDescription>
          </CardHeader>
          <CardContent>
            {proximas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nada vencendo nos próximos 7 dias.</p>
            ) : (
              <ul className="divide-y">
                {proximas.map((c: any) => (
                  <li key={c.id} className="py-2 flex items-center justify-between">
                    <div>
                      <Link href={`/clientes/${c.cliente.id}`} className="font-medium hover:underline">
                        {c.cliente.razaoSocial}
                      </Link>
                      <p className="text-xs text-muted-foreground">{c.descricao ?? "—"}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Vence {formatDate(c.vencimento)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
