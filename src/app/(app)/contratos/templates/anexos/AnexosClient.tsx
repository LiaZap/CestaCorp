"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Save, X, Tag as TagIcon, Upload } from "lucide-react";

type Anexo = {
  id: string;
  nome: string;
  descricao: string | null;
  arquivoDocx: string;
  ordem: number;
  ativo: boolean;
  autoAplicarTags: string[];
};

type TagOpt = { slug: string; nome: string; categoria: string };

type FormA = {
  id?: string;
  nome: string;
  descricao: string;
  arquivoDocx: string;
  ordem: number;
  ativo: boolean;
  autoAplicarTags: string[];
};

const VAZIO: FormA = {
  nome: "", descricao: "", arquivoDocx: "", ordem: 0, ativo: true, autoAplicarTags: [],
};

export function AnexosClient({
  anexos,
  tagsDisponiveis,
}: {
  anexos: Anexo[];
  tagsDisponiveis: TagOpt[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormA | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function abrirNovo() {
    setForm({ ...VAZIO });
    setErro(null);
  }

  function abrirEdicao(a: Anexo) {
    setForm({
      id: a.id,
      nome: a.nome,
      descricao: a.descricao ?? "",
      arquivoDocx: a.arquivoDocx,
      ordem: a.ordem,
      ativo: a.ativo,
      autoAplicarTags: a.autoAplicarTags,
    });
    setErro(null);
  }

  async function salvar() {
    if (!form) return;
    setLoading(true); setErro(null);
    try {
      const url = form.id ? `/api/contratos/anexos/${form.id}` : `/api/contratos/anexos`;
      const method = form.id ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          descricao: form.descricao || null,
          arquivoDocx: form.arquivoDocx,
          ordem: form.ordem,
          ativo: form.ativo,
          autoAplicarTags: form.autoAplicarTags,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(typeof j.error === "string" ? j.error : "erro ao salvar");
        return;
      }
      setForm(null);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function remover(id: string) {
    if (!confirm("Remover este anexo? Contratos já vinculados ficarão sem ele.")) return;
    const r = await fetch(`/api/contratos/anexos/${id}`, { method: "DELETE" });
    if (r.ok) router.refresh();
  }

  function toggleTag(slug: string) {
    if (!form) return;
    const set = new Set(form.autoAplicarTags);
    if (set.has(slug)) set.delete(slug);
    else set.add(slug);
    setForm({ ...form, autoAplicarTags: Array.from(set) });
  }

  // Agrupa tags por categoria pra mostrar bonito
  const tagsPorCategoria = tagsDisponiveis.reduce((acc, t) => {
    (acc[t.categoria] ??= []).push(t);
    return acc;
  }, {} as Record<string, TagOpt[]>);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={abrirNovo}>
          <Plus className="h-4 w-4" /> Novo anexo
        </Button>
      </div>

      {form && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{form.id ? "Editar anexo" : "Novo anexo"}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setForm(null)} aria-label="Fechar formulário"><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="ex: Anexo LGPD 2026"
                />
              </div>
              <div className="space-y-1">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={form.ordem}
                  onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Descrição</Label>
                <Input
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="o que esse anexo cobre"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="flex items-center gap-2">
                  <Upload className="h-3 w-3" /> Caminho do .docx
                </Label>
                <Input
                  value={form.arquivoDocx}
                  onChange={(e) => setForm({ ...form, arquivoDocx: e.target.value })}
                  placeholder="uploads/anexos/lgpd-2026.docx"
                />
                <p className="text-[11px] text-muted-foreground">
                  Faça upload do .docx via <code>/api/upload</code> e cole o caminho aqui.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              />
              Ativo (disponível para vincular a contratos)
            </label>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <TagIcon className="h-3 w-3" /> Auto-aplicar quando o cliente tiver as tags:
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Na geração em lote de contratos, este anexo será incluído automaticamente em qualquer cliente
                que tenha pelo menos uma das tags marcadas abaixo.
              </p>
              <div className="space-y-2">
                {Object.entries(tagsPorCategoria).map(([cat, tags]) => (
                  <div key={cat}>
                    <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">{cat}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((t) => {
                        const ativo = form.autoAplicarTags.includes(t.slug);
                        return (
                          <button
                            key={t.slug}
                            type="button"
                            onClick={() => toggleTag(t.slug)}
                            className={`text-xs px-2 py-1 rounded-full border transition ${
                              ativo
                                ? "bg-cestacorp-blue text-white border-cestacorp-blue"
                                : "bg-white border-slate-200 hover:border-cestacorp-blue/40"
                            }`}
                          >
                            {ativo && "✓ "}{t.nome}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {Object.keys(tagsPorCategoria).length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Nenhuma tag cadastrada. Importe a V-106 ou crie tags primeiro.
                  </p>
                )}
              </div>
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
              <Button onClick={salvar} disabled={loading || !form.nome || !form.arquivoDocx}>
                <Save className="h-4 w-4" /> {loading ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>{anexos.length} anexo{anexos.length !== 1 ? "s" : ""}</CardTitle></CardHeader>
        <CardContent>
          {anexos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum anexo cadastrado. Crie pra começar a oferecer cláusulas extras.
            </p>
          ) : (
            <ul className="divide-y">
              {anexos.map((a) => (
                <li key={a.id} className="py-3 flex items-start gap-3">
                  <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${a.ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                    {a.ordem || "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{a.nome}</p>
                      {!a.ativo && <span className="status-badge status-erro text-[10px]">inativo</span>}
                    </div>
                    {a.descricao && <p className="text-xs text-muted-foreground">{a.descricao}</p>}
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{a.arquivoDocx}</p>
                    {a.autoAplicarTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {a.autoAplicarTags.map((slug) => (
                          <span key={slug} className="text-[10px] bg-cestacorp-blue/10 text-cestacorp-blue px-1.5 py-0.5 rounded-full">
                            {slug}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => abrirEdicao(a)} aria-label={`Editar anexo ${a.nome}`}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remover(a.id)} aria-label={`Remover anexo ${a.nome}`}>
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
