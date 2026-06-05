"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MessageSquare, Calendar, Plus, Edit2, Trash2, Save, X, Check, RefreshCw, AlertCircle, CalendarCheck } from "lucide-react";

interface TextoData {
  id: string;
  titulo: string;
  texto: string;
  canal: string | null;
}

interface AgendamentoData {
  id: string;
  tagTextoId: string;
  dataExecucao: string;
  horarioEnvio: string;
  executado: boolean;
  executadoEm: string | null;
  erro: string | null;
}

interface Props {
  tagId: string;
  nomeTag: string;
  textosIniciais: TextoData[];
  agendamentosIniciais: AgendamentoData[];
  totais: { passados: number; futuros: number; executados: number; comErro: number };
}

const CANAIS = [
  { v: "whatsapp", l: "WhatsApp" },
  { v: "email", l: "E-mail" },
  { v: "sms", l: "SMS" },
];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function TagDetalheClient({ tagId, nomeTag, textosIniciais, agendamentosIniciais, totais }: Props) {
  const router = useRouter();
  const [textos, setTextos] = useState<TextoData[]>(textosIniciais);
  const [agendamentos, setAgendamentos] = useState<AgendamentoData[]>(agendamentosIniciais);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TextoData | null>(null);
  const [novaForm, setNovaForm] = useState<{ titulo: string; texto: string; canal: string } | null>(null);
  const [filtroAgendamentos, setFiltroAgendamentos] = useState<"futuros" | "passados" | "executados" | "todos">("futuros");

  const hoje = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const agendamentosFiltrados = useMemo(() => {
    return agendamentos.filter((a) => {
      const data = new Date(a.dataExecucao);
      if (filtroAgendamentos === "futuros") return !a.executado && data >= hoje;
      if (filtroAgendamentos === "passados") return !a.executado && data < hoje;
      if (filtroAgendamentos === "executados") return a.executado;
      return true;
    }).slice(0, 200);
  }, [agendamentos, filtroAgendamentos, hoje]);

  function comecarEditar(t: TextoData) {
    setEditId(t.id);
    setEditForm({ ...t });
  }

  function cancelarEdicao() {
    setEditId(null);
    setEditForm(null);
  }

  async function salvarEdicao() {
    if (!editForm) return;
    const r = await fetch(`/api/tags/${tagId}/textos/${editForm.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ titulo: editForm.titulo, texto: editForm.texto, canal: editForm.canal }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(`Erro: ${j.error ?? r.statusText}`);
      return;
    }
    const atualizado = await r.json();
    setTextos((s) => s.map((t) => (t.id === atualizado.id ? atualizado : t)));
    toast.success("Mensagem atualizada");
    cancelarEdicao();
  }

  async function excluirTexto(id: string) {
    if (!confirm("Excluir esta mensagem? Os agendamentos vinculados também serão removidos.")) return;
    const r = await fetch(`/api/tags/${tagId}/textos/${id}`, { method: "DELETE" });
    if (!r.ok) { toast.error("Falha ao excluir"); return; }
    setTextos((s) => s.filter((t) => t.id !== id));
    setAgendamentos((s) => s.filter((a) => a.tagTextoId !== id));
    toast.success("Mensagem excluída");
  }

  async function criarTexto() {
    if (!novaForm || novaForm.titulo.length < 2 || novaForm.texto.length < 2) {
      toast.error("Preencha título e texto"); return;
    }
    const r = await fetch(`/api/tags/${tagId}/textos`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(novaForm),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(`Erro: ${j.error ?? r.statusText}`);
      return;
    }
    const criado = await r.json();
    setTextos((s) => [...s, criado].sort((a, b) => a.titulo.localeCompare(b.titulo)));
    toast.success("Mensagem criada");
    setNovaForm(null);
  }

  async function alterarAgendamento(id: string, acao: "marcar-executado" | "marcar-pendente" | "cancelar") {
    const r = await fetch(`/api/tags/${tagId}/agendamentos/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ acao }),
    });
    if (!r.ok) { toast.error("Falha"); return; }
    const j = await r.json();
    if (j.removido) {
      setAgendamentos((s) => s.filter((a) => a.id !== id));
      toast.success("Agendamento cancelado");
    } else {
      setAgendamentos((s) => s.map((a) => (a.id === id ? j : a)));
      toast.success(acao === "marcar-executado" ? "Marcado como executado" : "Voltado a pendente");
    }
  }

  async function marcarPassadosComoExecutados() {
    if (!confirm("Marcar TODOS os agendamentos passados (data < hoje) como já executados? Útil depois do import V-106 pra evitar disparos retroativos.")) return;
    const r = await fetch(`/api/tags/${tagId}/agendamentos/marcar-passados`, { method: "POST" });
    if (!r.ok) { toast.error("Falha"); return; }
    const j = await r.json();
    toast.success(`${j.atualizados} agendamento(s) marcado(s) como executado`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* KPIs agendamentos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4">
          <p className="text-xs uppercase text-muted-foreground">Futuros pendentes</p>
          <p className="text-2xl font-bold text-amber-700">{totais.futuros}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs uppercase text-muted-foreground">Passados pendentes</p>
          <p className="text-2xl font-bold text-red-700">{totais.passados}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs uppercase text-muted-foreground">Executados</p>
          <p className="text-2xl font-bold text-emerald-700">{totais.executados}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs uppercase text-muted-foreground">Com erro</p>
          <p className="text-2xl font-bold text-red-700">{totais.comErro}</p>
        </CardContent></Card>
      </div>

      {/* Mensagens */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Mensagens ({textos.length})</CardTitle>
            <CardDescription>
              Textos enviados quando a tag dispara. Use placeholders <code>{"{cliente.razaoSocial}"}</code>, <code>{"{cobranca.valor|money}"}</code>, etc.
            </CardDescription>
          </div>
          <Button onClick={() => setNovaForm({ titulo: "", texto: "", canal: "whatsapp" })}>
            <Plus className="h-4 w-4" /> Nova mensagem
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {novaForm && (
            <div className="border-2 border-dashed border-cestacorp-blue/40 rounded-lg p-4 bg-cestacorp-blue/5 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Título *</Label>
                  <Input value={novaForm.titulo} onChange={(e) => setNovaForm({ ...novaForm, titulo: e.target.value })} placeholder="Ex: Lembrete de Honorário dia 5" />
                </div>
                <div>
                  <Label>Canal</Label>
                  <select
                    value={novaForm.canal}
                    onChange={(e) => setNovaForm({ ...novaForm, canal: e.target.value })}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    {CANAIS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <Label>Texto da mensagem *</Label>
                <textarea
                  value={novaForm.texto}
                  onChange={(e) => setNovaForm({ ...novaForm, texto: e.target.value })}
                  className="w-full min-h-32 rounded-md border bg-background p-3 text-sm font-mono"
                  placeholder="Olá {cliente.razaoSocial}, ..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setNovaForm(null)}>Cancelar</Button>
                <Button onClick={criarTexto}>Criar</Button>
              </div>
            </div>
          )}

          {textos.length === 0 && !novaForm && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma mensagem cadastrada. Clique em <strong>Nova mensagem</strong> ou importe a V-106.
            </p>
          )}

          {textos.map((t) =>
            editId === t.id && editForm ? (
              <div key={t.id} className="border-2 border-cestacorp-blue rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Título</Label>
                    <Input value={editForm.titulo} onChange={(e) => setEditForm({ ...editForm, titulo: e.target.value })} />
                  </div>
                  <div>
                    <Label>Canal</Label>
                    <select
                      value={editForm.canal ?? "whatsapp"}
                      onChange={(e) => setEditForm({ ...editForm, canal: e.target.value })}
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    >
                      {CANAIS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>Texto</Label>
                  <textarea
                    value={editForm.texto}
                    onChange={(e) => setEditForm({ ...editForm, texto: e.target.value })}
                    className="w-full min-h-40 rounded-md border bg-background p-3 text-sm font-mono"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={cancelarEdicao}><X className="h-4 w-4" /> Cancelar</Button>
                  <Button onClick={salvarEdicao}><Save className="h-4 w-4" /> Salvar</Button>
                </div>
              </div>
            ) : (
              <div key={t.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{t.titulo}</h3>
                    <Badge variant="outline" className="mt-1">{CANAIS.find((c) => c.v === (t.canal ?? "whatsapp"))?.l ?? t.canal}</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => comecarEditar(t)} aria-label={`Editar ${t.titulo}`}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => excluirTexto(t.id)} aria-label={`Excluir ${t.titulo}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <pre className="text-xs bg-muted rounded p-3 whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                  {t.texto}
                </pre>
                <p className="text-[10px] text-muted-foreground">
                  {agendamentos.filter((a) => a.tagTextoId === t.id).length} agendamento(s) vinculado(s)
                </p>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Agendamentos */}
      <Card>
        <CardHeader className="flex-row items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Agendamentos ({agendamentos.length})</CardTitle>
            <CardDescription>Cronograma de envios. Marcar passados como executados evita disparo retroativo.</CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { k: "futuros", l: `Futuros (${totais.futuros})` },
              { k: "passados", l: `Passados (${totais.passados})` },
              { k: "executados", l: `Executados (${totais.executados})` },
              { k: "todos", l: "Todos" },
            ].map((f) => (
              <Button
                key={f.k}
                size="sm"
                variant={filtroAgendamentos === f.k ? "default" : "outline"}
                onClick={() => setFiltroAgendamentos(f.k as any)}
              >
                {f.l}
              </Button>
            ))}
            {totais.passados > 0 && (
              <Button size="sm" variant="secondary" onClick={marcarPassadosComoExecutados}>
                <CalendarCheck className="h-4 w-4" /> Marcar passados executados
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {agendamentosFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum agendamento neste filtro.
            </p>
          ) : (
            <ul className="divide-y text-sm">
              {agendamentosFiltrados.map((a) => {
                const data = new Date(a.dataExecucao);
                const passou = data < hoje;
                const texto = textos.find((t) => t.id === a.tagTextoId);
                return (
                  <li key={a.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs font-mono shrink-0 px-2 py-1 rounded ${a.executado ? "bg-emerald-100 text-emerald-800" : passou ? "bg-red-100 text-red-800" : "bg-muted"}`}>
                        {fmt(a.dataExecucao)} {a.horarioEnvio}
                      </span>
                      <div className="min-w-0">
                        <span className="truncate block font-medium">{texto?.titulo ?? "(mensagem removida)"}</span>
                        {a.erro && (
                          <span className="text-[11px] text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{a.erro}</span>
                        )}
                        {a.executado && a.executadoEm && (
                          <span className="text-[11px] text-emerald-700">executado em {new Date(a.executadoEm).toLocaleString("pt-BR")}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {!a.executado && (
                        <Button size="icon" variant="ghost" onClick={() => alterarAgendamento(a.id, "marcar-executado")} aria-label="Marcar executado">
                          <Check className="h-4 w-4 text-emerald-700" />
                        </Button>
                      )}
                      {a.executado && (
                        <Button size="icon" variant="ghost" onClick={() => alterarAgendamento(a.id, "marcar-pendente")} aria-label="Voltar a pendente">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => alterarAgendamento(a.id, "cancelar")} aria-label="Cancelar agendamento">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {agendamentosFiltrados.length === 200 && (
            <p className="text-xs text-muted-foreground text-center mt-3">Mostrando primeiros 200 — use o filtro pra refinar.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
