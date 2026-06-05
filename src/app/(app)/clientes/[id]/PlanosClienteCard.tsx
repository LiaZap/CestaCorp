"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Layers, Plus, Pause, Play, Ban, Edit2, Save, X, AlertTriangle } from "lucide-react";

interface ServicoOpcao { id: string; nome: string; categoria: string; }
interface Plano {
  id: string;
  servicoId: string;
  status: "ATIVO" | "SUSPENSO" | "CANCELADO";
  valorMensal: number;
  diaVencimento: number | null;
  dataInicio: string;
  dataCancelamento: string | null;
  motivoCancelamento: string | null;
  observacao: string | null;
  servico: { id: string; nome: string; categoria: string };
}

interface Props {
  clienteId: string;
  planosIniciais: Plano[];
  servicosDisponiveis: ServicoOpcao[];
}

const STATUS_VIS = {
  ATIVO: { label: "ATIVO", className: "bg-emerald-600 text-white" },
  SUSPENSO: { label: "SUSPENSO", className: "bg-amber-500 text-white" },
  CANCELADO: { label: "CANCELADO", className: "bg-slate-400 text-white" },
} as const;

function fmtMoney(v: number | string) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function PlanosClienteCard({ clienteId, planosIniciais, servicosDisponiveis }: Props) {
  const router = useRouter();
  const [planos, setPlanos] = useState<Plano[]>(planosIniciais);
  const [modoCriar, setModoCriar] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editValor, setEditValor] = useState("");
  const [editDia, setEditDia] = useState("");

  // Form criação
  const [novoServicoId, setNovoServicoId] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [novoDia, setNovoDia] = useState("");
  const [novoObs, setNovoObs] = useState("");
  const [criando, setCriando] = useState(false);

  // Filtra serviços já contratados ativos pra não duplicar
  const servicosAtivos = new Set(planos.filter((p) => p.status === "ATIVO").map((p) => p.servicoId));
  const servicosDisponiveisFiltrados = servicosDisponiveis.filter((s) => !servicosAtivos.has(s.id));

  const valorTotal = planos.filter((p) => p.status === "ATIVO").reduce((acc, p) => acc + Number(p.valorMensal), 0);

  async function criar() {
    if (!novoServicoId) { toast.error("Selecione um serviço"); return; }
    const valor = Number(novoValor.replace(",", "."));
    if (!valor || valor < 0) { toast.error("Valor inválido"); return; }
    setCriando(true);
    try {
      const r = await fetch(`/api/clientes/${clienteId}/planos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          servicoId: novoServicoId,
          valorMensal: valor,
          diaVencimento: novoDia ? Number(novoDia) : null,
          observacao: novoObs || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error ?? "Falha ao criar plano"); return; }
      setPlanos((s) => [j, ...s]);
      toast.success("Plano criado");
      setModoCriar(false);
      setNovoServicoId(""); setNovoValor(""); setNovoDia(""); setNovoObs("");
      router.refresh();
    } finally { setCriando(false); }
  }

  function comecarEdicao(p: Plano) {
    setEditId(p.id);
    setEditValor(String(p.valorMensal));
    setEditDia(p.diaVencimento ? String(p.diaVencimento) : "");
  }

  async function salvarEdicao(planoId: string) {
    const valor = Number(editValor.replace(",", "."));
    if (!valor || valor < 0) { toast.error("Valor inválido"); return; }
    const r = await fetch(`/api/clientes/${clienteId}/planos/${planoId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        valorMensal: valor,
        diaVencimento: editDia ? Number(editDia) : null,
      }),
    });
    const j = await r.json();
    if (!r.ok) { toast.error(j.error ?? "Falha"); return; }
    setPlanos((s) => s.map((p) => p.id === j.id ? j : p));
    setEditId(null);
    toast.success("Plano atualizado");
  }

  async function alterarStatus(planoId: string, acao: "suspender" | "ativar" | "cancelar") {
    let motivo: string | undefined;
    if (acao === "cancelar") {
      motivo = prompt("Motivo do cancelamento (será registrado no histórico):")?.trim();
      if (!motivo) { toast.warning("Cancelado — motivo é obrigatório"); return; }
    } else if (acao === "suspender") {
      motivo = prompt("Motivo da suspensão (opcional):")?.trim() || undefined;
    }
    const r = await fetch(`/api/clientes/${clienteId}/planos/${planoId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ acao, motivo }),
    });
    const j = await r.json();
    if (!r.ok) { toast.error(j.error ?? "Falha"); return; }
    setPlanos((s) => s.map((p) => p.id === j.id ? j : p));
    toast.success(`Plano ${acao === "ativar" ? "reativado" : acao === "suspender" ? "suspenso" : "cancelado"}`);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" /> Planos contratados ({planos.filter((p) => p.status === "ATIVO").length})
          </CardTitle>
          <CardDescription>
            Contabilidade, Gestão de Consultório, BPO Financeiro… cada um pode ser cancelado independente.
            Receita mensal ativa: <strong className="text-cestacorp-blue">{fmtMoney(valorTotal)}</strong>
          </CardDescription>
        </div>
        {!modoCriar && servicosDisponiveisFiltrados.length > 0 && (
          <Button onClick={() => setModoCriar(true)}>
            <Plus className="h-4 w-4" /> Adicionar plano
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {modoCriar && (
          <div className="border-2 border-dashed border-cestacorp-blue/40 bg-cestacorp-blue/5 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Serviço *</Label>
                <select
                  value={novoServicoId}
                  onChange={(e) => setNovoServicoId(e.target.value)}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Selecione…</option>
                  {servicosDisponiveisFiltrados.map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Valor mensal *</Label>
                <Input value={novoValor} onChange={(e) => setNovoValor(e.target.value)} placeholder="600,00" />
              </div>
              <div>
                <Label>Dia do vencimento</Label>
                <Input value={novoDia} onChange={(e) => setNovoDia(e.target.value)} placeholder="5" inputMode="numeric" />
              </div>
            </div>
            <div>
              <Label>Observação</Label>
              <Input value={novoObs} onChange={(e) => setNovoObs(e.target.value)} placeholder="Ex.: Desconto especial primeira mensalidade" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setModoCriar(false)}>Cancelar</Button>
              <Button onClick={criar} disabled={criando}>{criando ? "Salvando…" : "Criar plano"}</Button>
            </div>
          </div>
        )}

        {planos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum plano contratado ainda. Clique em <strong>Adicionar plano</strong>.
          </p>
        ) : (
          <ul className="space-y-2">
            {planos.map((p) => {
              const vis = STATUS_VIS[p.status];
              const editando = editId === p.id;
              return (
                <li key={p.id} className={`border rounded-lg p-3 ${p.status === "CANCELADO" ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{p.servico.nome}</span>
                        <Badge className={vis.className}>{vis.label}</Badge>
                        <Badge variant="outline" className="text-[10px]">{p.servico.categoria}</Badge>
                      </div>
                      {editando ? (
                        <div className="grid grid-cols-2 gap-2 mt-2 max-w-md">
                          <div>
                            <Label className="text-xs">Valor mensal</Label>
                            <Input value={editValor} onChange={(e) => setEditValor(e.target.value)} className="h-8" />
                          </div>
                          <div>
                            <Label className="text-xs">Dia vencimento</Label>
                            <Input value={editDia} onChange={(e) => setEditDia(e.target.value)} className="h-8" />
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          <strong className="text-cestacorp-blue">{fmtMoney(p.valorMensal)}</strong>
                          {p.diaVencimento ? ` · dia ${p.diaVencimento}` : ""}
                          {` · desde ${fmtDate(p.dataInicio)}`}
                          {p.dataCancelamento && (
                            <> · <span className="text-red-700">cancelado em {fmtDate(p.dataCancelamento)}</span></>
                          )}
                        </p>
                      )}
                      {p.motivoCancelamento && p.status !== "ATIVO" && (
                        <p className="text-xs italic mt-1 bg-muted rounded px-2 py-1">
                          <AlertTriangle className="h-3 w-3 inline-block mr-1" />
                          {p.motivoCancelamento}
                        </p>
                      )}
                      {p.observacao && !editando && (
                        <p className="text-xs text-muted-foreground mt-1">{p.observacao}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {editando ? (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => salvarEdicao(p.id)} aria-label="Salvar">
                            <Save className="h-4 w-4 text-emerald-700" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditId(null)} aria-label="Cancelar edição">
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          {p.status === "ATIVO" && (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => comecarEdicao(p)} aria-label="Editar plano">
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => alterarStatus(p.id, "suspender")} aria-label="Suspender">
                                <Pause className="h-4 w-4 text-amber-600" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => alterarStatus(p.id, "cancelar")} aria-label="Cancelar">
                                <Ban className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                          {p.status === "SUSPENSO" && (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => alterarStatus(p.id, "ativar")} aria-label="Reativar">
                                <Play className="h-4 w-4 text-emerald-700" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => alterarStatus(p.id, "cancelar")} aria-label="Cancelar">
                                <Ban className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
