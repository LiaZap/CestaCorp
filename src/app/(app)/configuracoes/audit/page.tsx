import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { ArrowLeft, Shield, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  "cliente.create": "Criou cliente",
  "cliente.update": "Editou cliente",
  "cliente.delete": "Excluiu cliente",
  "reajuste.aplicar": "Aplicou reajuste",
  "cobranca.marcar-paga": "Marcou cobrança paga",
  "execucao.reenviar": "Reenviou execução",
  "contrato.gerar": "Gerou contrato",
};

const ACTION_COLORS: Record<string, string> = {
  "cliente.create": "bg-emerald-50 text-emerald-700",
  "cliente.update": "bg-blue-50 text-blue-700",
  "cliente.delete": "bg-red-50 text-red-700",
  "reajuste.aplicar": "bg-amber-50 text-amber-700",
  "cobranca.marcar-paga": "bg-cestacorp-green/10 text-cestacorp-greenDark",
  "execucao.reenviar": "bg-purple-50 text-purple-700",
  "contrato.gerar": "bg-violet-50 text-violet-700",
};

/**
 * Mapeia o tipo de `resource` do audit log pra rota da UI. Sem mapping,
 * o ID fica como texto não-clicável (#83) — evita Link 404 pra recursos
 * sem tela própria (ex: indice_customizado, regra-tag).
 */
const RESOURCE_PATH: Record<string, (id: string) => string> = {
  cliente: (id) => `/clientes/${id}`,
  cobranca: (id) => `/cobrancas/${id}`,
  contrato: (id) => `/contratos/${id}`,
  execucao: (id) => `/regua-cobranca/execucao/${id}`,
  obrigacao: (id) => `/agenda/${id}`,
  pre_cadastro: (id) => `/clientes/pre-cadastros/${id}`,
  contrato_template: (id) => `/contratos/templates/${id}`,
  regua: (id) => `/regua-cobranca/${id}`,
  "regra-tag": (id) => `/tags#${id}`,
};

export default async function AuditLogPage({ searchParams }: { searchParams: { action?: string; resource?: string } }) {
  const where: any = {};
  if (searchParams.action) where.action = searchParams.action;
  if (searchParams.resource) where.resource = searchParams.resource;

  const [logs, totalAcoes, porAcao] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.auditLog.count(),
    prisma.auditLog.groupBy({ by: ["action"], _count: true, orderBy: { _count: { action: "desc" } }, take: 10 }),
  ]);

  return (
    <div className="space-y-6 max-w-6xl">
      <Link href="/configuracoes" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Configurações
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <Shield className="h-7 w-7" /> Log de auditoria
        </h1>
        <p className="text-muted-foreground">
          Histórico completo de ações sensíveis — {totalAcoes} evento{totalAcoes !== 1 ? "s" : ""} registrado{totalAcoes !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {porAcao.slice(0, 3).map((a) => (
          <Card key={a.action}>
            <CardContent className="pt-6">
              <p className="text-xs uppercase text-muted-foreground">{ACTION_LABELS[a.action] ?? a.action}</p>
              <p className="text-2xl font-bold mt-1">{a._count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Últimos 200 eventos</CardTitle>
          <CardDescription>Filtre clicando nas ações. Retenção: 365 dias.</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
          ) : (
            <ul className="divide-y text-sm">
              {logs.map((l) => (
                <li key={l.id} className="py-3 flex items-start gap-3">
                  <div className="shrink-0 text-xs text-muted-foreground w-28">{formatDateTime(l.createdAt)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={"status-badge text-[10px] " + (ACTION_COLORS[l.action] ?? "status-aberto")}>
                        {ACTION_LABELS[l.action] ?? l.action}
                      </span>
                      <span className="text-xs text-muted-foreground">por <b>{l.actorEmail ?? l.actorId}</b></span>
                      {l.actorType !== "equipe" && (
                        <span className="text-[10px] text-muted-foreground">({l.actorType})</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {l.resource}
                      {l.resourceId && (() => {
                        const buildPath = RESOURCE_PATH[l.resource];
                        const idLabel = `#${l.resourceId.slice(0, 8)}`;
                        return buildPath ? (
                          <Link href={buildPath(l.resourceId)} className="ml-1 hover:text-primary font-mono">{idLabel}</Link>
                        ) : (
                          <span className="ml-1 font-mono" title="recurso sem rota mapeada">{idLabel}</span>
                        );
                      })()}
                      {l.ip && <span className="ml-2">· IP {l.ip}</span>}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
