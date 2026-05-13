"use client";
import Link from "next/link";
import { useState } from "react";
import {
  FileText, MessageSquare, MessageCircle, AlertTriangle, CheckCircle2,
  ClipboardList, Pin, UserPlus, CreditCard,
} from "lucide-react";
import { cn, formatDateTime, formatMoney } from "@/lib/utils";
import type { TimelineEvent } from "@/lib/services/cliente-timeline";
import { Button } from "@/components/ui/button";

const ICONS: Record<TimelineEvent["tipo"], any> = {
  contrato_emitido: FileText,
  cobranca_emitida: CreditCard,
  cobranca_paga: CheckCircle2,
  cobranca_atrasada: AlertTriangle,
  mensagem_enviada: MessageSquare,
  mensagem_recebida: MessageCircle,
  execucao_regua: MessageSquare,
  form_respondido: ClipboardList,
  observacao: Pin,
  cliente_criado: UserPlus,
};

const CORES: Record<TimelineEvent["tipo"], string> = {
  contrato_emitido: "bg-purple-100 text-purple-700",
  cobranca_emitida: "bg-blue-100 text-blue-700",
  cobranca_paga: "bg-emerald-100 text-emerald-700",
  cobranca_atrasada: "bg-red-100 text-red-700",
  mensagem_enviada: "bg-cyan-100 text-cyan-700",
  mensagem_recebida: "bg-indigo-100 text-indigo-700",
  execucao_regua: "bg-amber-100 text-amber-700",
  form_respondido: "bg-violet-100 text-violet-700",
  observacao: "bg-lime-100 text-lime-700",
  cliente_criado: "bg-muted text-foreground",
};

const LABELS: Record<string, string> = {
  contrato_emitido: "Contrato",
  cobranca_emitida: "Cobrança",
  cobranca_paga: "Pago",
  cobranca_atrasada: "Atraso",
  mensagem_enviada: "→ Msg",
  mensagem_recebida: "← Msg",
  execucao_regua: "Régua",
  form_respondido: "Formulário",
  observacao: "Obs",
  cliente_criado: "Cadastro",
  todos: "Todos",
};

export function ClienteTimeline({ eventos, clienteId }: { eventos: TimelineEvent[]; clienteId: string }) {
  const [filtro, setFiltro] = useState<string>("todos");
  const [novaObs, setNovaObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  const filtrados = filtro === "todos" ? eventos : eventos.filter((e) => e.tipo === filtro);

  async function salvarObs(e: React.FormEvent) {
    e.preventDefault();
    if (!novaObs.trim()) return;
    setSalvando(true);
    const res = await fetch(`/api/clientes/${clienteId}/observacoes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conteudo: novaObs }),
    });
    setSalvando(false);
    if (res.ok) {
      setNovaObs("");
      window.location.reload();
    }
  }

  const tipos = Array.from(new Set(eventos.map((e) => e.tipo)));

  return (
    <div className="space-y-4">
      {/* Form de observação */}
      <form onSubmit={salvarObs} className="flex gap-2">
        <input
          type="text"
          value={novaObs}
          onChange={(e) => setNovaObs(e.target.value)}
          placeholder="Adicionar observação à timeline…"
          className="flex-1 h-10 rounded-md border bg-background px-3 text-sm"
        />
        <Button type="submit" disabled={!novaObs.trim() || salvando}>
          {salvando ? "Salvando…" : "Adicionar"}
        </Button>
      </form>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFiltro("todos")}
          className={cn(
            "status-badge cursor-pointer",
            filtro === "todos" ? "bg-primary text-white" : "status-aberto"
          )}
        >
          Todos ({eventos.length})
        </button>
        {tipos.map((t) => (
          <button
            key={t}
            onClick={() => setFiltro(t)}
            className={cn(
              "status-badge cursor-pointer",
              filtro === t ? "bg-primary text-white" : CORES[t as keyof typeof CORES]
            )}
          >
            {LABELS[t] ?? t} ({eventos.filter((e) => e.tipo === t).length})
          </button>
        ))}
      </div>

      {/* Timeline */}
      {filtrados.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Nenhum evento nesta categoria.
        </p>
      ) : (
        <ol className="relative border-l-2 border-muted ml-3 space-y-4">
          {filtrados.map((e) => {
            const Icon = ICONS[e.tipo];
            const valor = e.meta?.valor;
            const body = (
              <div className="pl-8 relative py-1">
                <span className={cn(
                  "absolute -left-3 top-2 h-6 w-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm",
                  CORES[e.tipo]
                )}>
                  <Icon className="h-3 w-3" />
                </span>
                <div className="bg-white border rounded-md p-3 hover:border-primary transition">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{e.titulo}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(e.data)}
                    </span>
                  </div>
                  {e.descricao && (
                    <p className="text-sm text-muted-foreground mt-1">{e.descricao}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs">
                    {valor != null && (
                      <span className="font-mono text-muted-foreground">{formatMoney(valor)}</span>
                    )}
                    {e.meta?.status && (
                      <span className="status-badge status-aberto text-[10px]">{e.meta.status}</span>
                    )}
                    {e.autor && <span className="text-muted-foreground">por {e.autor}</span>}
                  </div>
                </div>
              </div>
            );
            return (
              <li key={e.id}>
                {e.href ? <Link href={e.href}>{body}</Link> : body}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
