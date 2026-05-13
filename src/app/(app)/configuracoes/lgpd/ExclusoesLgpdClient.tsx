"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, Play, AlertCircle, Clock } from "lucide-react";
import { formatDateTime, formatCpfCnpj } from "@/lib/utils";

type Solicitacao = {
  id: string;
  status: string;
  motivo: string | null;
  decisao: string | null;
  solicitadoEm: string;
  revisadoEm: string | null;
  executadoEm: string | null;
  cliente: {
    id: string;
    codigo: number | null;
    razaoSocial: string;
    cpfCnpj: string;
    status: string;
  };
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDENTE: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
  APROVADA: { label: "Aprovada — aguarda execução", cls: "bg-blue-100 text-blue-800" },
  NEGADA: { label: "Negada", cls: "bg-red-100 text-red-800" },
  EXECUTADA: { label: "Executada", cls: "bg-emerald-100 text-emerald-800" },
};

export function ExclusoesLgpdClient({ solicitacoes }: { solicitacoes: Solicitacao[] }) {
  const router = useRouter();
  const [agindo, setAgindo] = useState<{ id: string; acao: "aprovar" | "negar" | "executar" } | null>(null);
  const [decisao, setDecisao] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function executarAcao() {
    if (!agindo) return;
    setLoading(true); setErro(null);
    try {
      const r = await fetch(`/api/lgpd/exclusoes/${agindo.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ acao: agindo.acao, decisao: decisao || undefined }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(typeof j.error === "string" ? j.error : "erro");
        return;
      }
      setAgindo(null);
      setDecisao("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (solicitacoes.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma solicitação LGPD ativa.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>{solicitacoes.length} solicitação(ões)</CardTitle></CardHeader>
      <CardContent>
        <ul className="divide-y">
          {solicitacoes.map((s) => {
            const badge = STATUS_BADGE[s.status];
            const podeAprovar = s.status === "PENDENTE";
            const podeExecutar = s.status === "APROVADA";
            return (
              <li key={s.id} className="py-4 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={`/clientes/${s.cliente.id}`} className="font-semibold hover:underline">
                        #{s.cliente.codigo ?? "—"} · {s.cliente.razaoSocial}
                      </a>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge?.cls}`}>
                        {badge?.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{formatCpfCnpj(s.cliente.cpfCnpj)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Solicitado {formatDateTime(s.solicitadoEm)}
                      {s.revisadoEm && ` · revisado ${formatDateTime(s.revisadoEm)}`}
                      {s.executadoEm && ` · executado ${formatDateTime(s.executadoEm)}`}
                    </p>
                    {s.motivo && (
                      <p className="text-sm bg-muted/40 rounded p-2 mt-2 italic">"{s.motivo}"</p>
                    )}
                    {s.decisao && (
                      <p className="text-xs mt-1">
                        <span className="text-muted-foreground">Resposta da equipe:</span> {s.decisao}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {podeAprovar && (
                      <>
                        <Button size="sm" onClick={() => setAgindo({ id: s.id, acao: "aprovar" })}>
                          <Check className="h-3 w-3 text-emerald-300" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setAgindo({ id: s.id, acao: "negar" })}>
                          <X className="h-3 w-3 text-red-600" /> Negar
                        </Button>
                      </>
                    )}
                    {podeExecutar && (
                      <Button
                        size="sm"
                        onClick={() => {
                          if (confirm("Executar anonimização? Os dados pessoais do cliente serão substituídos por valores neutros e o portal será desativado. Esta ação NÃO PODE ser desfeita.")) {
                            setAgindo({ id: s.id, acao: "executar" });
                            setTimeout(() => executarAcao(), 0);
                          }
                        }}
                      >
                        <Play className="h-3 w-3" /> Executar exclusão
                      </Button>
                    )}
                  </div>
                </div>

                {agindo?.id === s.id && (agindo.acao === "aprovar" || agindo.acao === "negar") && (
                  <div className="mt-3 border-t pt-3 space-y-2">
                    <p className="text-sm font-semibold">
                      {agindo.acao === "aprovar" ? "Aprovar solicitação" : "Negar solicitação"}
                    </p>
                    <textarea
                      className="w-full min-h-20 rounded-md border bg-background p-2 text-sm"
                      placeholder={agindo.acao === "negar" ? "Justificativa (obrigatória)" : "Observação (opcional)"}
                      value={decisao}
                      onChange={(e) => setDecisao(e.target.value)}
                    />
                    {erro && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {erro}
                      </p>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setAgindo(null); setDecisao(""); setErro(null); }}>Cancelar</Button>
                      <Button
                        size="sm"
                        onClick={executarAcao}
                        disabled={loading || (agindo.acao === "negar" && !decisao)}
                      >
                        {loading ? "Salvando…" : agindo.acao === "aprovar" ? "Aprovar" : "Negar"}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
