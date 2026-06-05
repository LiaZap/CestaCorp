"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, FileText, GripVertical } from "lucide-react";
import { toast } from "@/lib/toast";

interface Tipo {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  ordem: number;
  exigeOriginal: boolean;
  qtdTemplates: number;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function TiposContratoClient({ tipos }: { tipos: Tipo[] }) {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [novo, setNovo] = useState({ nome: "", descricao: "", exigeOriginal: false });
  const [salvando, setSalvando] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!novo.nome.trim()) return;
    setSalvando(true);
    try {
      const r = await fetch("/api/tipos-contrato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: slugify(novo.nome),
          nome: novo.nome.trim(),
          descricao: novo.descricao.trim() || null,
          exigeOriginal: novo.exigeOriginal,
          ordem: tipos.length,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        toast.error(typeof j.error === "string" ? j.error : "Falha ao criar tipo");
        return;
      }
      toast.success(`Tipo "${j.nome}" criado`);
      setNovo({ nome: "", descricao: "", exigeOriginal: false });
      setCriando(false);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivo(t: Tipo) {
    const r = await fetch(`/api/tipos-contrato/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !t.ativo }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.error || "Falha ao atualizar");
      return;
    }
    toast.success(t.ativo ? "Tipo desativado" : "Tipo reativado");
    router.refresh();
  }

  async function remover(t: Tipo) {
    if (!confirm(
      t.qtdTemplates > 0
        ? `Esse tipo tem ${t.qtdTemplates} template(s) usando. Vai apenas desativar (não apaga). Confirma?`
        : `Excluir tipo "${t.nome}"?`
    )) return;
    const r = await fetch(`/api/tipos-contrato/${t.id}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j.error || "Falha ao remover");
      return;
    }
    const j = await r.json();
    toast.success(j.soft ? "Tipo desativado (preserva templates existentes)" : "Tipo excluído");
    router.refresh();
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">
            {tipos.length} tipo{tipos.length !== 1 ? "s" : ""} cadastrado{tipos.length !== 1 ? "s" : ""}
          </CardTitle>
          {!criando && (
            <Button size="sm" onClick={() => setCriando(true)}>
              <Plus className="h-4 w-4" /> Novo tipo
            </Button>
          )}
        </CardHeader>

        {criando && (
          <CardContent className="border-b">
            <form onSubmit={criar} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="nv-nome" className="text-xs font-medium text-muted-foreground">
                    Nome <span className="text-red-600">*</span>
                  </label>
                  <Input
                    id="nv-nome"
                    autoFocus
                    placeholder="ex: Aditivo Contratual"
                    value={novo.nome}
                    onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                    required
                  />
                  {novo.nome && (
                    <p className="text-[10px] text-muted-foreground font-mono">slug: {slugify(novo.nome)}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label htmlFor="nv-desc" className="text-xs font-medium text-muted-foreground">
                    Descrição (opcional)
                  </label>
                  <Input
                    id="nv-desc"
                    placeholder="Quando usar este tipo"
                    value={novo.descricao}
                    onChange={(e) => setNovo({ ...novo, descricao: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={novo.exigeOriginal}
                  onChange={(e) => setNovo({ ...novo, exigeOriginal: e.target.checked })}
                />
                Exige contrato original (aditivos sempre referenciam outro contrato)
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setCriando(false)} disabled={salvando}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={salvando || !novo.nome.trim()}>
                  {salvando ? "Salvando…" : "Criar tipo"}
                </Button>
              </div>
            </form>
          </CardContent>
        )}

        <CardContent>
          {tipos.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhum tipo cadastrado.
              <br />
              <button onClick={() => setCriando(true)} className="text-primary hover:underline">
                Criar o primeiro
              </button>
              .
            </div>
          ) : (
            <ul className="divide-y">
              {tipos.map((t) => (
                <li key={t.id} className="py-3 flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText className="h-4 w-4 text-cestacorp-blue" />
                      <p className={"font-medium " + (!t.ativo ? "text-muted-foreground line-through" : "")}>
                        {t.nome}
                      </p>
                      <span className="text-[10px] font-mono bg-muted/60 rounded px-1.5 py-0.5">{t.slug}</span>
                      {t.exigeOriginal && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 rounded px-1.5 py-0.5">
                          exige original
                        </span>
                      )}
                      {!t.ativo && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">inativo</span>
                      )}
                    </div>
                    {t.descricao && <p className="text-xs text-muted-foreground mt-0.5">{t.descricao}</p>}
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t.qtdTemplates} {t.qtdTemplates === 1 ? "template usa" : "templates usam"} este tipo
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => toggleAtivo(t)}>
                      {t.ativo ? "Desativar" : "Reativar"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => remover(t)}
                      aria-label={`Remover ${t.nome}`}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground italic">
        Esta lista alimenta o seletor de tipo ao criar/editar um <code>ContratoTemplate</code>.
        Templates existentes mantêm o tipo como string livre até serem reassociados.
      </p>
    </>
  );
}
