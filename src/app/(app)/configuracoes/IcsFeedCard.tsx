"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Copy, RefreshCw, Check, Filter } from "lucide-react";

const FEEDS_PRONTOS = [
  { label: "Todos os eventos", filtro: "" },
  { label: "Só Simples Nacional", filtro: "?tag=simples-nacional" },
  { label: "Só Lucro Presumido", filtro: "?tag=presumido-servicos" },
  { label: "Só DAS", filtro: "?tipo=DAS" },
  { label: "Só FGTS", filtro: "?tipo=FGTS" },
  { label: "Só DEFIS", filtro: "?tipo=DEFIS" },
];

export function IcsFeedCard() {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);

  async function carregar() {
    setLoading(true);
    try {
      const r = await fetch("/api/agenda/ics-token");
      const j = await r.json();
      if (j?.url) setUrl(j.url);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function regenerar() {
    if (!confirm("Gerar um novo link? O link atual deixará de funcionar no Google Calendar.")) return;
    setRotating(true);
    try {
      const r = await fetch("/api/agenda/ics-token", { method: "POST" });
      const j = await r.json();
      if (j?.url) setUrl(j.url);
    } finally {
      setRotating(false);
    }
  }

  async function copiar(targetUrl: string, key: string) {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      const el = document.createElement("input");
      el.value = targetUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" /> Agenda no Google Calendar
        </CardTitle>
        <CardDescription>
          Assine este link no Google Calendar (ou Apple/Outlook) para ver as obrigações e eventos
          dos clientes direto no seu calendário.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : url ? (
          <>
            <p className="text-xs text-muted-foreground">
              Crie <b>múltiplos calendários</b> filtrados — útil pra ver só obrigações de um regime ou tipo.
              Cada filtro vira um link separado pra assinar no Google Calendar.
            </p>

            <div className="space-y-2">
              {FEEDS_PRONTOS.map((feed) => {
                const fullUrl = url + feed.filtro;
                const key = feed.label;
                const copiado = copiedKey === key;
                return (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <Filter className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="font-medium w-40 shrink-0">{feed.label}</span>
                    <input
                      readOnly
                      value={fullUrl}
                      className="flex-1 font-mono text-[11px] px-2 py-1.5 rounded border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-cestacorp-blue truncate"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <Button
                      type="button"
                      variant={copiado ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => copiar(fullUrl, key)}
                    >
                      {copiado ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                );
              })}
            </div>

            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer hover:text-foreground font-medium">
                Como assinar no Google Calendar
              </summary>
              <ol className="mt-2 ml-4 list-decimal space-y-1">
                <li>Copie o link do filtro desejado</li>
                <li>Google Calendar → &ldquo;Outros calendários&rdquo; → &ldquo;+&rdquo; → &ldquo;Por URL&rdquo;</li>
                <li>Cole o link e confirme</li>
                <li>Repita pra cada filtro que quiser ter num calendário separado</li>
                <li>Use cores diferentes pra distinguir Simples vs Presumido</li>
              </ol>
              <p className="mt-2">
                Você também pode customizar a URL adicionando <code>?tag=slug-da-tag</code>,
                <code> ?tipo=DAS</code>, ou <code>?responsavel=Camila</code>.
              </p>
            </details>

            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={regenerar} disabled={rotating}>
                <RefreshCw className={"h-3 w-3 " + (rotating ? "animate-spin" : "")} />
                {rotating ? "Gerando…" : "Gerar novo token (revoga o antigo)"}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-red-600">Não foi possível carregar o link.</p>
        )}
      </CardContent>
    </Card>
  );
}
