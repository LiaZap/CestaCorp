"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, AlertCircle, Clock, Check, X } from "lucide-react";

type Solicitacao = {
  id: string;
  status: string;
  motivo: string | null;
  decisao: string | null;
  solicitadoEm: string;
  revisadoEm: string | null;
  executadoEm: string | null;
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDENTE: { label: "Em análise", cls: "bg-amber-100 text-amber-800" },
  APROVADA: { label: "Aprovada", cls: "bg-blue-100 text-blue-800" },
  NEGADA: { label: "Negada", cls: "bg-red-100 text-red-800" },
  EXECUTADA: { label: "Concluída", cls: "bg-emerald-100 text-emerald-800" },
};

export function ExclusaoLgpdCard({ solicitacoes }: { solicitacoes: Solicitacao[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pendente = solicitacoes.find((s) => s.status === "PENDENTE" || s.status === "APROVADA");

  async function solicitar() {
    if (!confirm(
      "Você está solicitando a EXCLUSÃO dos seus dados na Cestacorp.\n\n" +
      "A equipe vai revisar em até 15 dias úteis. Se aprovada, seus dados pessoais serão " +
      "anonimizados e seu acesso ao portal será encerrado.\n\n" +
      "Deseja prosseguir?"
    )) return;

    setLoading(true); setErro(null);
    try {
      const r = await fetch("/api/portal/exclusao-lgpd", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ motivo: motivo || undefined }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(typeof j.error === "string" ? j.error : "erro");
        return;
      }
      setAberto(false);
      setMotivo("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-5 w-5 text-amber-600" /> Direitos LGPD
        </CardTitle>
        <CardDescription>
          A LGPD garante seu direito de solicitar a exclusão dos dados pessoais que a Cestacorp guarda sobre você (Art. 18, V).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendente && (
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm">
            <p className="font-semibold text-amber-900 flex items-center gap-1">
              <Clock className="h-4 w-4" /> Você já tem uma solicitação em andamento
            </p>
            <p className="text-amber-800 mt-1">
              Status: <b>{STATUS_BADGE[pendente.status]?.label}</b> · solicitada em{" "}
              {new Date(pendente.solicitadoEm).toLocaleDateString("pt-BR")}
            </p>
            <p className="text-xs text-amber-700 mt-1">
              A equipe Cestacorp tem até 15 dias úteis para avaliar. Você receberá retorno por e-mail.
            </p>
          </div>
        )}

        {!pendente && !aberto && (
          <Button variant="outline" onClick={() => setAberto(true)}>
            <ShieldAlert className="h-4 w-4 text-amber-600" /> Solicitar exclusão dos meus dados
          </Button>
        )}

        {aberto && (
          <div className="space-y-3 border-t pt-3">
            <p className="text-sm font-semibold">Solicitação de exclusão (LGPD)</p>
            <p className="text-xs text-muted-foreground">
              Conte brevemente o motivo (opcional). Isso ajuda a equipe a avaliar e responder você melhor.
            </p>
            <textarea
              className="w-full min-h-24 rounded-md border bg-background p-3 text-sm"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: encerrei a empresa, prefiro não manter dados, etc."
              maxLength={2000}
            />
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
              <p className="font-semibold">⚠ O que vai acontecer se for aprovada:</p>
              <ul className="mt-1 ml-4 list-disc space-y-0.5">
                <li>Seus dados pessoais (nome, CPF, e-mail, telefone) serão anonimizados</li>
                <li>O acesso ao portal será encerrado</li>
                <li>Cobranças e contratos já fechados continuam no histórico (exigência fiscal)</li>
                <li>Não é possível desfazer depois de executada</li>
              </ul>
            </div>
            {erro && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-4 w-4" /> {erro}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setAberto(false); setMotivo(""); }}>
                <X className="h-4 w-4" /> Cancelar
              </Button>
              <Button onClick={solicitar} disabled={loading}>
                <Check className="h-4 w-4" /> {loading ? "Enviando…" : "Enviar solicitação"}
              </Button>
            </div>
          </div>
        )}

        {solicitacoes.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
              Histórico de solicitações ({solicitacoes.length})
            </summary>
            <ul className="mt-2 space-y-2">
              {solicitacoes.map((s) => {
                const badge = STATUS_BADGE[s.status];
                return (
                  <li key={s.id} className="border rounded-md p-2">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${badge?.cls}`}>
                        {badge?.label ?? s.status}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        {new Date(s.solicitadoEm).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    {s.motivo && <p className="mt-1 text-muted-foreground italic">"{s.motivo}"</p>}
                    {s.decisao && (
                      <p className="mt-1 text-muted-foreground">
                        <b>Resposta:</b> {s.decisao}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
