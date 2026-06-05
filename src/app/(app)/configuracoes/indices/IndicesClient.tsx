"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Save, X, TrendingUp } from "lucide-react";

type ValorMensal = { ano: number; mes: number; valor: number };

type Indice = {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  valorFixo: number | null;
  valoresMensais: ValorMensal[];
  fonte: string | null;
  ativo: boolean;
};

type FormI = {
  id?: string;
  slug: string;
  nome: string;
  descricao: string;
  tipo: "fixo" | "tabela";
  valorFixo: string;
  valoresMensais: ValorMensal[];
  fonte: string;
  ativo: boolean;
};

const VAZIO: FormI = {
  slug: "", nome: "", descricao: "", tipo: "fixo",
  valorFixo: "", valoresMensais: [], fonte: "", ativo: true,
};

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function IndicesClient({ indices }: { indices: Indice[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormI | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function abrirNovo() {
    setForm({ ...VAZIO });
    setErro(null);
  }

  function abrirEdicao(i: Indice) {
    setForm({
      id: i.id,
      slug: i.slug,
      nome: i.nome,
      descricao: i.descricao ?? "",
      tipo: i.tipo as "fixo" | "tabela",
      valorFixo: i.valorFixo != null ? String(i.valorFixo) : "",
      valoresMensais: i.valoresMensais,
      fonte: i.fonte ?? "",
      ativo: i.ativo,
    });
    setErro(null);
  }

  function setField<K extends keyof FormI>(k: K, v: FormI[K]) {
    if (!form) return;
    setForm({ ...form, [k]: v });
  }

  async function salvar() {
    if (!form) return;
    setLoading(true); setErro(null);
    try {
      const body = {
        slug: form.slug,
        nome: form.nome,
        descricao: form.descricao || null,
        tipo: form.tipo,
        valorFixo: form.tipo === "fixo" ? Number(form.valorFixo) : null,
        valoresMensais: form.tipo === "tabela" ? form.valoresMensais : [],
        fonte: form.fonte || null,
        ativo: form.ativo,
      };
      const url = form.id ? `/api/indices-customizados/${form.id}` : "/api/indices-customizados";
      const method = form.id ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(typeof j.error === "string" ? j.error : "erro");
        return;
      }
      setForm(null);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function remover(id: string) {
    if (!confirm("Remover este índice? Não afeta contratos já gerados.")) return;
    const r = await fetch(`/api/indices-customizados/${id}`, { method: "DELETE" });
    if (r.ok) router.refresh();
  }

  function adicionarMes() {
    if (!form) return;
    const hoje = new Date();
    const ultimo = form.valoresMensais[form.valoresMensais.length - 1];
    const proximoMes = ultimo
      ? (ultimo.mes === 12 ? { ano: ultimo.ano + 1, mes: 1 } : { ano: ultimo.ano, mes: ultimo.mes + 1 })
      : { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1 };
    setForm({
      ...form,
      valoresMensais: [...form.valoresMensais, { ...proximoMes, valor: 0 }],
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={abrirNovo}>
          <Plus className="h-4 w-4" /> Novo índice
        </Button>
      </div>

      {form && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{form.id ? "Editar índice" : "Novo índice customizado"}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setForm(null)} aria-label="Fechar formulário">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1 md:col-span-2">
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => {
                    const novo = e.target.value;
                    setForm({
                      ...form,
                      nome: novo,
                      slug: form.id ? form.slug : slugify(novo),
                    });
                  }}
                  placeholder="ex: IPCA cheio 2025"
                />
              </div>
              <div className="space-y-1">
                <Label>Slug *</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setField("slug", e.target.value.toLowerCase())}
                  placeholder="ipca-cheio-2025"
                  disabled={Boolean(form.id)}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label>Descrição</Label>
                <Input value={form.descricao} onChange={(e) => setField("descricao", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Fonte</Label>
                <Input
                  value={form.fonte}
                  onChange={(e) => setField("fonte", e.target.value)}
                  placeholder="IBGE, FGV, interno"
                />
              </div>

              <div className="space-y-1">
                <Label>Tipo *</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.tipo}
                  onChange={(e) => setField("tipo", e.target.value as "fixo" | "tabela")}
                >
                  <option value="fixo">Percentual fixo</option>
                  <option value="tabela">Tabela mensal</option>
                </select>
              </div>

              {form.tipo === "fixo" && (
                <div className="space-y-1 md:col-span-2">
                  <Label>Valor (%) *</Label>
                  <Input
                    type="number" step="0.01"
                    value={form.valorFixo}
                    onChange={(e) => setField("valorFixo", e.target.value)}
                    placeholder="ex: 5.0 = 5% ao ano"
                  />
                </div>
              )}
            </div>

            {form.tipo === "tabela" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Valores mensais (%)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={adicionarMes}>
                    <Plus className="h-3 w-3" /> Adicionar mês
                  </Button>
                </div>
                {form.valoresMensais.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum mês cadastrado. Clique em "Adicionar mês".</p>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {form.valoresMensais.map((vm, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          className="h-9 rounded-md border bg-background px-2 text-sm w-24"
                          value={vm.mes}
                          onChange={(e) => {
                            const nova = [...form.valoresMensais];
                            nova[idx] = { ...vm, mes: Number(e.target.value) };
                            setField("valoresMensais", nova);
                          }}
                        >
                          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                        <Input
                          type="number"
                          value={vm.ano}
                          onChange={(e) => {
                            const nova = [...form.valoresMensais];
                            nova[idx] = { ...vm, ano: Number(e.target.value) || 0 };
                            setField("valoresMensais", nova);
                          }}
                          className="w-24"
                          placeholder="ano"
                        />
                        <Input
                          type="number" step="0.01"
                          value={vm.valor}
                          onChange={(e) => {
                            const nova = [...form.valoresMensais];
                            nova[idx] = { ...vm, valor: Number(e.target.value) || 0 };
                            setField("valoresMensais", nova);
                          }}
                          className="flex-1"
                          placeholder="ex: 4.5"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const nova = form.valoresMensais.filter((_, i) => i !== idx);
                            setField("valoresMensais", nova);
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setField("ativo", e.target.checked)}
              />
              Ativo (disponível pra usar em reajustes)
            </label>

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
              <Button onClick={salvar} disabled={loading || !form.nome || !form.slug}>
                <Save className="h-4 w-4" /> {loading ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{indices.length} índice{indices.length !== 1 ? "s" : ""}</CardTitle></CardHeader>
        <CardContent>
          {indices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum índice customizado. Crie pra liberar mais opções nos reajustes.
            </p>
          ) : (
            <ul className="divide-y">
              {indices.map((i) => (
                <li key={i.id} className="py-3 flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${
                    i.ativo ? "bg-cestacorp-blue/10 text-cestacorp-blue" : "bg-slate-100 text-slate-400"
                  }`}>
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{i.nome}</p>
                      <code className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                        {i.slug}
                      </code>
                      {!i.ativo && <span className="status-badge status-erro text-[10px]">inativo</span>}
                    </div>
                    {i.descricao && <p className="text-xs text-muted-foreground">{i.descricao}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {i.tipo === "fixo"
                        ? `Fixo: ${i.valorFixo ?? 0}% ao ano`
                        : `Tabela: ${i.valoresMensais.length} mês(es) cadastrado(s)`}
                      {i.fonte && ` · fonte: ${i.fonte}`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => abrirEdicao(i)} aria-label={`Editar índice ${i.nome}`}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remover(i.id)} aria-label={`Remover índice ${i.nome}`}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
