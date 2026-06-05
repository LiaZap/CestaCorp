"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, XCircle, Copy, RefreshCw, ExternalLink } from "lucide-react";

interface ProviderHealth {
  key: string;
  label: string;
  url: string;
  eventos: string[];
  secretEnv: string;
  tokenEnv: string;
  secretConfigurado: boolean;
  tokenConfigurado: boolean;
  ultimoEvento: string | null;
  ultimoEventoTipo: string | null;
  totalUltimas24h: number;
  totalTotal: number;
  status: "ok" | "atencao" | "erro";
}

function tempoRelativo(iso: string | null): string {
  if (!iso) return "nunca";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

const STATUS_VIS = {
  ok: { icon: CheckCircle2, color: "text-green-600", label: "OK", variant: "default" as const },
  atencao: { icon: AlertTriangle, color: "text-amber-500", label: "Atenção", variant: "secondary" as const },
  erro: { icon: XCircle, color: "text-destructive", label: "Erro", variant: "destructive" as const },
};

export function WebhooksHealthClient() {
  const [data, setData] = useState<{ providers: ProviderHealth[]; geradoEm: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/health/webhooks", { cache: "no-store" });
      if (!r.ok) throw new Error("Falha ao carregar");
      setData(await r.json());
    } catch (err: any) {
      toast.error(`Erro: ${err.message ?? err}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  function copiar(texto: string, label: string) {
    navigator.clipboard.writeText(texto);
    toast.success(`${label} copiado`);
  }

  if (!data) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        {loading ? "Verificando…" : "Aguardando…"}
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-sm text-muted-foreground">
        <span>Atualizado {tempoRelativo(data.geradoEm)}</span>
        <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Recarregar
        </Button>
      </div>

      {data.providers.map((p) => {
        const vis = STATUS_VIS[p.status];
        const Icon = vis.icon;
        return (
          <Card key={p.key}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${vis.color}`} />
                    {p.label}
                    <Badge variant={vis.variant}>{vis.label}</Badge>
                  </CardTitle>
                  <CardDescription>
                    {p.ultimoEvento
                      ? `Último evento: ${tempoRelativo(p.ultimoEvento)}${p.ultimoEventoTipo ? ` (${p.ultimoEventoTipo})` : ""}`
                      : "Nenhum evento recebido ainda"}
                  </CardDescription>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>24h: <strong>{p.totalUltimas24h}</strong></div>
                  <div>total: <strong>{p.totalTotal}</strong></div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Secret ({p.secretEnv})</div>
                  <Badge variant={p.secretConfigurado ? "default" : "destructive"}>
                    {p.secretConfigurado ? "configurado" : "FALTANDO"}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">API Token ({p.tokenEnv})</div>
                  <Badge variant={p.tokenConfigurado ? "default" : "secondary"}>
                    {p.tokenConfigurado ? "configurado" : "ausente"}
                  </Badge>
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-1">URL do webhook (cole no painel da plataforma)</div>
                <div className="flex items-center gap-2 bg-muted rounded px-3 py-2 text-sm font-mono break-all">
                  <span className="flex-1">{p.url}</span>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => copiar(p.url, "URL")}
                    aria-label={`Copiar URL ${p.label}`}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div>
                <div className="text-xs text-muted-foreground mb-1">Eventos esperados</div>
                <div className="flex flex-wrap gap-1.5">
                  {p.eventos.map((e) => (
                    <Badge key={e} variant="outline" className="font-mono text-xs">{e}</Badge>
                  ))}
                </div>
              </div>

              {p.status === "erro" && (
                <div className="text-xs bg-destructive/10 text-destructive rounded px-3 py-2">
                  <strong>Secret {p.secretEnv} ausente no EasyPanel.</strong> Endpoint retorna 503 e
                  qualquer evento real está sendo recusado. Gere 32 bytes random, cole no EasyPanel,
                  redeploy, e cole o mesmo valor no painel {p.label}.
                </div>
              )}
              {p.status === "atencao" && p.secretConfigurado && (
                <div className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded px-3 py-2">
                  Secret configurado, mas nenhum evento nas últimas 24h. Confirme no painel {p.label}
                  que a URL acima está registrada e os eventos estão marcados. Use o botão "Enviar
                  webhook de teste" do painel.
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
