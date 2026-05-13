"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Play, Trash2, CheckCircle2, XCircle, Zap } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type Regra = {
  id: string; nome: string; tagId: string; tagNome: string; tagCor: string;
  condicao: string; params: any; acao: string; ativa: boolean;
  totalAplicacoes: number; ultimaExecucao: string | null;
};

type Tag = { id: string; nome: string; cor: string };

const CONDICOES = [
  { value: "COBRANCA_ATRASADA_DIAS", label: "Cobrança atrasada há X dias", campo: "diasMinimos", tipo: "number" },
  { value: "PAGO_MESES_SEGUIDOS", label: "Pagou em dia X meses seguidos", campo: "meses", tipo: "number" },
  { value: "SEM_COBRANCA_ABERTA", label: "Sem cobranças em aberto", campo: null, tipo: null },
  { value: "MES_ANIVERSARIO", label: "Mês do aniversário do contrato", campo: null, tipo: null },
  { value: "TRIBUTACAO_CONTAINS", label: "Tributação contém", campo: "texto", tipo: "text" },
  { value: "CLASSIFICACAO", label: "Classificação igual a", campo: "valor", tipo: "select", options: ["BRONZE", "PRATA", "OURO", "TOP"] },
  { value: "STATUS", label: "Status igual a", campo: "valor", tipo: "select", options: ["ATIVO", "INATIVO", "PROSPECT", "SUSPENSO", "ENCERRADO"] },
];

export function RegrasClient({ regras: regrasIniciais, tags }: { regras: Regra[]; tags: Tag[] }) {
  const [regras, setRegras] = useState(regrasIniciais);
  const [aberta, setAberta] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [form, setForm] = useState({
    tagId: tags[0]?.id ?? "",
    nome: "",
    condicao: "COBRANCA_ATRASADA_DIAS",
    paramValue: "7",
    acao: "APLICAR",
  });

  const condicaoMeta = CONDICOES.find((c) => c.value === form.condicao)!;

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    const params: any = {};
    if (condicaoMeta.campo) {
      params[condicaoMeta.campo] = condicaoMeta.tipo === "number" ? Number(form.paramValue) : form.paramValue;
    }
    const res = await fetch("/api/regras-tag", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tagId: form.tagId, nome: form.nome,
        condicao: form.condicao, params, acao: form.acao,
      }),
    });
    if (!res.ok) return;
    const r = await res.json();
    const tag = tags.find((t) => t.id === form.tagId)!;
    setRegras((rs) => [{
      id: r.id, nome: r.nome, tagId: r.tagId, tagNome: tag.nome, tagCor: tag.cor,
      condicao: r.condicao, params: r.params, acao: r.acao, ativa: true,
      totalAplicacoes: 0, ultimaExecucao: null,
    }, ...rs]);
    setAberta(false);
    setForm({ ...form, nome: "" });
  }

  async function toggle(id: string, ativa: boolean) {
    await fetch(`/api/regras-tag/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ativa: !ativa }),
    });
    setRegras((rs) => rs.map((r) => r.id === id ? { ...r, ativa: !ativa } : r));
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta regra?")) return;
    await fetch(`/api/regras-tag/${id}`, { method: "DELETE" });
    setRegras((rs) => rs.filter((r) => r.id !== id));
  }

  async function rodarAgora() {
    setRodando(true);
    setFeedback(null);
    const res = await fetch("/api/regras-tag", { method: "PUT" });
    const json = await res.json();
    setRodando(false);
    if (res.ok) setFeedback(`${json.regras} regras processadas · ${json.aplicadas} tags aplicadas · ${json.removidas} removidas.`);
  }

  function labelCondicao(c: string) {
    return CONDICOES.find((x) => x.value === c)?.label ?? c;
  }

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button onClick={rodarAgora} variant="secondary" disabled={rodando}>
          <Play className="h-4 w-4" /> {rodando ? "Executando…" : "Executar agora"}
        </Button>
        <Button onClick={() => setAberta((v) => !v)}>
          <Plus className="h-4 w-4" /> Nova regra
        </Button>
      </div>

      {feedback && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="inline h-4 w-4 mr-1" /> {feedback}
        </div>
      )}

      {aberta && (
        <Card>
          <CardHeader><CardTitle>Nova regra</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={criar} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Nome da regra</Label>
                  <Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Aplicar INADIMPLENTE após 7d" />
                </div>
                <div className="space-y-1">
                  <Label>Tag alvo</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.tagId}
                    onChange={(e) => setForm({ ...form, tagId: e.target.value })}
                  >
                    {tags.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Ação</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.acao}
                    onChange={(e) => setForm({ ...form, acao: e.target.value })}
                  >
                    <option value="APLICAR">Aplicar tag quando condição bater</option>
                    <option value="REMOVER">Remover tag quando condição bater</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Condição</Label>
                  <select
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.condicao}
                    onChange={(e) => setForm({ ...form, condicao: e.target.value, paramValue: "" })}
                  >
                    {CONDICOES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                {condicaoMeta.campo && (
                  <div className="space-y-1 md:col-span-2">
                    <Label>Valor ({condicaoMeta.campo})</Label>
                    {condicaoMeta.tipo === "select" ? (
                      <select
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                        value={form.paramValue}
                        onChange={(e) => setForm({ ...form, paramValue: e.target.value })}
                      >
                        <option value="">—</option>
                        {(condicaoMeta as any).options?.map((o: string) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <Input
                        type={condicaoMeta.tipo as any}
                        value={form.paramValue}
                        onChange={(e) => setForm({ ...form, paramValue: e.target.value })}
                      />
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setAberta(false)}>Cancelar</Button>
                <Button type="submit">Criar regra</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{regras.length} regra{regras.length !== 1 ? "s" : ""}</CardTitle>
          <CardDescription>Executadas diariamente na rodada da régua</CardDescription>
        </CardHeader>
        <CardContent>
          {regras.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma regra ainda.</p>
          ) : (
            <ul className="divide-y">
              {regras.map((r) => (
                <li key={r.id} className="py-3 flex items-start gap-3 flex-wrap">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0" style={{ background: r.tagCor + "25", color: r.tagCor }}>
                    <Zap className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{r.nome}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-medium">{r.acao === "APLICAR" ? "Aplica" : "Remove"}</span> tag{" "}
                      <span className="inline-flex items-center gap-1 font-mono" style={{ color: r.tagCor }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: r.tagCor }} />
                        {r.tagNome}
                      </span>
                      {" quando: "}
                      <b>{labelCondicao(r.condicao)}</b>
                      {r.params && Object.keys(r.params).length > 0 && (
                        <span className="ml-1 font-mono">({Object.values(r.params).join(", ")})</span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {r.totalAplicacoes} aplicações totais
                      {r.ultimaExecucao && <> · última execução {formatDateTime(r.ultimaExecucao)}</>}
                    </p>
                  </div>
                  <Button size="sm" variant={r.ativa ? "outline" : "secondary"} onClick={() => toggle(r.id, r.ativa)}>
                    {r.ativa ? <><XCircle className="h-3 w-3" /> Pausar</> : <><CheckCircle2 className="h-3 w-3" /> Ativar</>}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => excluir(r.id)} aria-label="Excluir">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
