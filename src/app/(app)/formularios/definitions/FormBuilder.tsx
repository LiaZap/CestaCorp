"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Save, Eye, EyeOff, Settings2,
  Type, AlignLeft, Mail, Phone, Hash, DollarSign, Calendar as CalIcon,
  ListChecks, CircleDot, Square, Upload as UploadIcon, FolderOpen,
  Heading2, FileText as FileTextIcon, Copy, X, AlertCircle,
} from "lucide-react";

type FieldType =
  | "text" | "textarea" | "email" | "phone" | "cpf" | "cnpj"
  | "date" | "number" | "money" | "select" | "multiselect"
  | "radio" | "checkbox" | "file" | "section";

type Option = { label: string; value: string };

type Field = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  helpText?: string;
  placeholder?: string;
  options?: Option[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    regex?: string;
  };
  mapping?: {
    entity?: "cliente" | "socio" | "contato" | "endereco";
    field?: string;
  };
  showIf?: { field: string; equals: any };
};

type FormDef = {
  id?: string;
  slug: string;
  title: string;
  description?: string;
  category: string;
  fields: Field[];
  active: boolean;
  notifyEmails: string[];
  versao?: number;
};

const TIPOS: { value: FieldType; label: string; icon: any; descricao: string }[] = [
  { value: "text", label: "Texto curto", icon: Type, descricao: "Linha simples — nome, razão social, etc." },
  { value: "textarea", label: "Texto longo", icon: AlignLeft, descricao: "Múltiplas linhas — observações" },
  { value: "email", label: "E-mail", icon: Mail, descricao: "Validação de e-mail automática" },
  { value: "phone", label: "Telefone", icon: Phone, descricao: "Telefone com DDD" },
  { value: "cpf", label: "CPF", icon: Hash, descricao: "CPF com validação de dígitos" },
  { value: "cnpj", label: "CNPJ", icon: Hash, descricao: "CNPJ com validação" },
  { value: "date", label: "Data", icon: CalIcon, descricao: "Seletor de data" },
  { value: "number", label: "Número", icon: Hash, descricao: "Inteiro ou decimal" },
  { value: "money", label: "Valor (R$)", icon: DollarSign, descricao: "Valor em reais" },
  { value: "select", label: "Lista (escolher 1)", icon: ListChecks, descricao: "Dropdown com opções" },
  { value: "multiselect", label: "Lista (escolher vários)", icon: ListChecks, descricao: "Dropdown múltipla escolha" },
  { value: "radio", label: "Radio", icon: CircleDot, descricao: "Botões de rádio (escolher 1)" },
  { value: "checkbox", label: "Checkbox", icon: Square, descricao: "Caixas (escolher vários)" },
  { value: "file", label: "Upload de arquivo", icon: UploadIcon, descricao: "Cliente envia documento" },
  { value: "section", label: "Seção (título)", icon: Heading2, descricao: "Divisor visual com título" },
];

const CATEGORIAS = [
  { value: "abertura-empresa", label: "Abertura de empresa" },
  { value: "alteracao-empresa", label: "Alteração de empresa" },
  { value: "abertura-mei", label: "Abertura MEI" },
  { value: "alteracao-mei", label: "Alteração MEI" },
  { value: "socios", label: "Sócios" },
  { value: "carne-leao", label: "Carnê-Leão" },
  { value: "esocial-domestico", label: "eSocial Doméstico" },
  { value: "gps-avulsa", label: "GPS Avulsa" },
  { value: "outros", label: "Outros" },
];

const TEM_OPCOES: FieldType[] = ["select", "multiselect", "radio", "checkbox"];

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function camelize(s: string): string {
  const base = s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim().split(/\s+/);
  if (base.length === 0) return "campo";
  return base[0] + base.slice(1).map((p) => p[0].toUpperCase() + p.slice(1)).join("");
}

function novoCampo(tipo: FieldType, label: string): Field {
  const f: Field = { key: camelize(label) || "campo", label, type: tipo };
  if (TEM_OPCOES.includes(tipo)) {
    f.options = [{ label: "Opção 1", value: "opcao_1" }];
  }
  return f;
}

const DEFAULT: FormDef = {
  slug: "",
  title: "",
  description: "",
  category: "outros",
  fields: [],
  active: true,
  notifyEmails: [],
};

export function FormBuilder({ initial }: { initial?: FormDef }) {
  const router = useRouter();
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState<FormDef>(initial ?? DEFAULT);
  const [campoSelecionado, setCampoSelecionado] = useState<number | null>(null);
  const [novoTipoAberto, setNovoTipoAberto] = useState(false);
  const [previewAberto, setPreviewAberto] = useState(true);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function setMeta<K extends keyof FormDef>(k: K, v: FormDef[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function addCampo(tipo: FieldType) {
    const t = TIPOS.find((x) => x.value === tipo)!;
    const novo = novoCampo(tipo, t.label);
    setForm((s) => ({ ...s, fields: [...s.fields, novo] }));
    setCampoSelecionado(form.fields.length);
    setNovoTipoAberto(false);
  }

  function updateCampo(idx: number, patch: Partial<Field>) {
    setForm((s) => ({
      ...s,
      fields: s.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    }));
  }

  function removerCampo(idx: number) {
    if (!confirm("Remover este campo?")) return;
    setForm((s) => ({ ...s, fields: s.fields.filter((_, i) => i !== idx) }));
    setCampoSelecionado(null);
  }

  function moverCampo(idx: number, dir: -1 | 1) {
    const novoIdx = idx + dir;
    if (novoIdx < 0 || novoIdx >= form.fields.length) return;
    const arr = [...form.fields];
    [arr[idx], arr[novoIdx]] = [arr[novoIdx], arr[idx]];
    setForm((s) => ({ ...s, fields: arr }));
    if (campoSelecionado === idx) setCampoSelecionado(novoIdx);
  }

  function duplicarCampo(idx: number) {
    const f = form.fields[idx];
    const dup: Field = { ...f, key: f.key + "_copia", label: f.label + " (cópia)" };
    setForm((s) => ({
      ...s,
      fields: [...s.fields.slice(0, idx + 1), dup, ...s.fields.slice(idx + 1)],
    }));
  }

  async function salvar() {
    setLoading(true); setErro(null);
    try {
      const url = isEdit ? `/api/forms/definitions/${form.id}` : `/api/forms/definitions`;
      const method = isEdit ? "PATCH" : "POST";
      const body = {
        slug: form.slug.toLowerCase(),
        title: form.title,
        description: form.description || undefined,
        category: form.category,
        fields: form.fields,
        active: form.active,
        notifyEmails: form.notifyEmails,
      };
      const r = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) {
        const msg = typeof j.error === "string"
          ? j.error
          : "Verifique os campos obrigatórios";
        setErro(msg);
        return;
      }
      router.push("/formularios/definitions");
      router.refresh();
    } catch (e: any) {
      setErro(String(e?.message ?? e).slice(0, 200));
    } finally {
      setLoading(false);
    }
  }

  async function remover() {
    if (!confirm("Excluir este formulário? Respostas existentes ficam preservadas.")) return;
    if (!form.id) return;
    const r = await fetch(`/api/forms/definitions/${form.id}`, { method: "DELETE" });
    if (r.ok) {
      router.push("/formularios/definitions");
      router.refresh();
    }
  }

  async function duplicar() {
    if (!form.id) return;
    if (!confirm(`Duplicar "${form.title}" como novo formulário (com sufixo -copia)?`)) return;
    const r = await fetch(`/api/forms/definitions/${form.id}/duplicar`, { method: "POST" });
    const j = await r.json();
    if (!r.ok) { setErro(j.error ?? "Falha"); return; }
    router.push(`/formularios/definitions/${j.id}`);
    router.refresh();
  }

  const campoAtual = campoSelecionado !== null ? form.fields[campoSelecionado] : null;

  // Pra mostrar a regra showIf, precisamos da lista de outros campos
  const outrosCampos = useMemo(
    () => form.fields.filter((_, i) => i !== campoSelecionado),
    [form.fields, campoSelecionado]
  );

  return (
    <div className="space-y-6">
      {/* Header com ações */}
      <div className="flex items-start justify-between flex-wrap gap-3 sticky top-0 bg-background z-10 py-2 -mx-1 px-1">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewAberto(!previewAberto)}
            title={previewAberto ? "Ocultar preview" : "Mostrar preview"}
          >
            {previewAberto ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {previewAberto ? "Ocultar preview" : "Mostrar preview"}
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setMeta("active", e.target.checked)}
            />
            Ativo (disponível em <code>/forms/{form.slug || "..."}</code>)
          </label>
          {isEdit && form.versao && (
            <span className="text-xs text-muted-foreground" title="Cada salvamento que muda os campos vira nova versão. Respostas antigas continuam válidas.">
              versão {form.versao}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {isEdit && (
            <Button variant="outline" size="sm" onClick={duplicar} title="Cria cópia inativa pra editar sem afetar este">
              <Copy className="h-4 w-4" /> Duplicar
            </Button>
          )}
          {isEdit && (
            <Button variant="outline" size="sm" onClick={remover}>
              <Trash2 className="h-4 w-4 text-destructive" /> Excluir
            </Button>
          )}
          <Button
            onClick={salvar}
            disabled={loading || !form.title || !form.slug || form.fields.length === 0}
          >
            <Save className="h-4 w-4" /> {loading ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar formulário"}
          </Button>
        </div>
      </div>

      {erro && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {erro}
        </div>
      )}

      <div className={`grid gap-4 ${previewAberto ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        {/* ============ EDITOR ============ */}
        <div className="space-y-4">
          {/* Metadados */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Informações gerais</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 md:col-span-2">
                <Label>Título *</Label>
                <Input
                  value={form.title}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((s) => ({
                      ...s,
                      title: v,
                      slug: isEdit ? s.slug : slugify(v),
                    }));
                  }}
                  placeholder="ex: Cadastro inicial — Sócio"
                />
              </div>
              <div className="space-y-1">
                <Label>Slug (URL) *</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setMeta("slug", e.target.value.toLowerCase())}
                  placeholder="cadastro-socio"
                  disabled={isEdit}
                />
                <p className="text-[10px] text-muted-foreground">
                  Link público: <code>/forms/{form.slug || "..."}</code>
                </p>
              </div>
              <div className="space-y-1">
                <Label>Categoria *</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.category}
                  onChange={(e) => setMeta("category", e.target.value)}
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Descrição (aparece no topo do formulário)</Label>
                <textarea
                  className="w-full min-h-16 rounded-md border bg-background p-2 text-sm"
                  value={form.description ?? ""}
                  onChange={(e) => setMeta("description", e.target.value)}
                  placeholder="Explique pra quem vai preencher o que esperar"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>E-mails que recebem notificação ao receber resposta</Label>
                <Input
                  value={form.notifyEmails.join(", ")}
                  onChange={(e) => setMeta("notifyEmails", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                  placeholder="financeiro@cestacorp.com.br, contabilidade@cestacorp.com.br"
                />
                <p className="text-[10px] text-muted-foreground">
                  Separe múltiplos e-mails com vírgula
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Lista de campos */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">2. Campos do formulário</CardTitle>
                <CardDescription>
                  {form.fields.length} campo{form.fields.length !== 1 ? "s" : ""} · clique pra editar
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {form.fields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum campo ainda. Clique em "Adicionar campo" pra começar.
                </p>
              )}

              {form.fields.map((f, idx) => {
                const tipo = TIPOS.find((t) => t.value === f.type);
                const Icon = tipo?.icon ?? Type;
                const selecionado = idx === campoSelecionado;
                return (
                  <div
                    key={idx}
                    onClick={() => setCampoSelecionado(idx)}
                    className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition ${
                      selecionado
                        ? "bg-cestacorp-blue/5 border-cestacorp-blue"
                        : "bg-white hover:border-slate-300"
                    } ${f.type === "section" ? "bg-slate-50" : ""}`}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${f.type === "section" ? "font-bold" : "font-medium"}`}>
                        {f.label || "(sem rótulo)"}
                        {f.required && <span className="text-red-500 ml-1">*</span>}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {f.key} · {tipo?.label ?? f.type}
                      </p>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); moverCampo(idx, -1); }}
                        disabled={idx === 0}
                        className="p-1 hover:bg-muted rounded disabled:opacity-30"
                        title="Mover pra cima"
                      >
                        <ChevronUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); moverCampo(idx, 1); }}
                        disabled={idx === form.fields.length - 1}
                        className="p-1 hover:bg-muted rounded disabled:opacity-30"
                        title="Mover pra baixo"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); duplicarCampo(idx); }}
                        className="p-1 hover:bg-muted rounded"
                        title="Duplicar"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removerCampo(idx); }}
                        className="p-1 hover:bg-red-100 rounded"
                        title="Remover"
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Botão adicionar — abre seletor de tipo */}
              {!novoTipoAberto ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setNovoTipoAberto(true)}
                >
                  <Plus className="h-4 w-4" /> Adicionar campo
                </Button>
              ) : (
                <div className="border-2 border-dashed border-cestacorp-blue/30 rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Escolha o tipo:</p>
                    <Button variant="ghost" size="icon" onClick={() => setNovoTipoAberto(false)} aria-label="Fechar seleção de tipo">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                    {TIPOS.map((t) => {
                      const Icon = t.icon;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => addCampo(t.value)}
                          className="flex items-start gap-2 p-2 rounded-md border bg-white hover:border-cestacorp-blue hover:bg-cestacorp-blue/5 text-left transition"
                          title={t.descricao}
                        >
                          <Icon className="h-4 w-4 text-cestacorp-blue mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium leading-tight">{t.label}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Editor do campo selecionado */}
          {campoAtual && (
            <Card className="border-cestacorp-blue/30">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Editando: <span className="text-cestacorp-blue">{campoAtual.label}</span>
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setCampoSelecionado(null)} aria-label="Fechar painel de campo">
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {campoAtual.type === "section" ? (
                  <div className="space-y-1">
                    <Label>Título da seção</Label>
                    <Input
                      value={campoAtual.label}
                      onChange={(e) => updateCampo(campoSelecionado!, { label: e.target.value })}
                    />
                    <p className="text-[10px] text-muted-foreground">Aparece como divisor visual no formulário</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1 md:col-span-2">
                        <Label>Rótulo *</Label>
                        <Input
                          value={campoAtual.label}
                          onChange={(e) => {
                            const novoLabel = e.target.value;
                            updateCampo(campoSelecionado!, {
                              label: novoLabel,
                              key: campoAtual.key === camelize(campoAtual.label) ? camelize(novoLabel) : campoAtual.key,
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Chave (key)</Label>
                        <Input
                          value={campoAtual.key}
                          onChange={(e) => updateCampo(campoSelecionado!, { key: e.target.value })}
                        />
                        <p className="text-[10px] text-muted-foreground">Identificador único (sem espaços)</p>
                      </div>
                      <div className="space-y-1">
                        <Label>Tipo</Label>
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          value={campoAtual.type}
                          onChange={(e) => updateCampo(campoSelecionado!, { type: e.target.value as FieldType })}
                        >
                          {TIPOS.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label>Texto de ajuda (helpText)</Label>
                        <Input
                          value={campoAtual.helpText ?? ""}
                          onChange={(e) => updateCampo(campoSelecionado!, { helpText: e.target.value })}
                          placeholder="aparece embaixo do campo, em cinza"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label>Placeholder (texto fantasma)</Label>
                        <Input
                          value={campoAtual.placeholder ?? ""}
                          onChange={(e) => updateCampo(campoSelecionado!, { placeholder: e.target.value })}
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm pt-1">
                      <input
                        type="checkbox"
                        checked={campoAtual.required ?? false}
                        onChange={(e) => updateCampo(campoSelecionado!, { required: e.target.checked })}
                      />
                      Obrigatório
                    </label>

                    {/* Opções (select/multiselect/radio/checkbox) */}
                    {TEM_OPCOES.includes(campoAtual.type) && (
                      <div className="space-y-2 border-t pt-3">
                        <div className="flex items-center justify-between">
                          <Label>Opções de escolha</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const opts = campoAtual.options ?? [];
                              updateCampo(campoSelecionado!, {
                                options: [...opts, { label: `Opção ${opts.length + 1}`, value: `opcao_${opts.length + 1}` }],
                              });
                            }}
                          >
                            <Plus className="h-3 w-3" /> Adicionar opção
                          </Button>
                        </div>
                        <div className="space-y-1">
                          {(campoAtual.options ?? []).map((opt, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <Input
                                value={opt.label}
                                onChange={(e) => {
                                  const opts = [...(campoAtual.options ?? [])];
                                  opts[i] = { ...opt, label: e.target.value, value: opt.value === slugify(opt.label) ? slugify(e.target.value) : opt.value };
                                  updateCampo(campoSelecionado!, { options: opts });
                                }}
                                placeholder="Rótulo visível"
                              />
                              <Input
                                value={opt.value}
                                onChange={(e) => {
                                  const opts = [...(campoAtual.options ?? [])];
                                  opts[i] = { ...opt, value: e.target.value };
                                  updateCampo(campoSelecionado!, { options: opts });
                                }}
                                placeholder="Valor"
                                className="w-32"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const opts = (campoAtual.options ?? []).filter((_, idx) => idx !== i);
                                  updateCampo(campoSelecionado!, { options: opts });
                                }}
                                className="p-2 hover:bg-red-100 rounded"
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Validação */}
                    <details className="border-t pt-3">
                      <summary className="cursor-pointer text-sm font-medium">Validação avançada</summary>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {(campoAtual.type === "text" || campoAtual.type === "textarea") && (
                          <>
                            <div className="space-y-1">
                              <Label className="text-xs">Mínimo de caracteres</Label>
                              <Input type="number"
                                value={campoAtual.validation?.minLength ?? ""}
                                onChange={(e) => updateCampo(campoSelecionado!, {
                                  validation: { ...campoAtual.validation, minLength: e.target.value ? Number(e.target.value) : undefined }
                                })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Máximo de caracteres</Label>
                              <Input type="number"
                                value={campoAtual.validation?.maxLength ?? ""}
                                onChange={(e) => updateCampo(campoSelecionado!, {
                                  validation: { ...campoAtual.validation, maxLength: e.target.value ? Number(e.target.value) : undefined }
                                })}
                              />
                            </div>
                          </>
                        )}
                        {(campoAtual.type === "number" || campoAtual.type === "money") && (
                          <>
                            <div className="space-y-1">
                              <Label className="text-xs">Valor mínimo</Label>
                              <Input type="number" step="0.01"
                                value={campoAtual.validation?.min ?? ""}
                                onChange={(e) => updateCampo(campoSelecionado!, {
                                  validation: { ...campoAtual.validation, min: e.target.value ? Number(e.target.value) : undefined }
                                })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Valor máximo</Label>
                              <Input type="number" step="0.01"
                                value={campoAtual.validation?.max ?? ""}
                                onChange={(e) => updateCampo(campoSelecionado!, {
                                  validation: { ...campoAtual.validation, max: e.target.value ? Number(e.target.value) : undefined }
                                })}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </details>

                    {/* Mapeamento + condicional */}
                    <details className="border-t pt-3">
                      <summary className="cursor-pointer text-sm font-medium">Mapeamento e condicional</summary>
                      <div className="space-y-3 mt-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Mapeia para</Label>
                            <select
                              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                              value={campoAtual.mapping?.entity ?? ""}
                              onChange={(e) => updateCampo(campoSelecionado!, {
                                mapping: { ...campoAtual.mapping, entity: e.target.value as any || undefined }
                              })}
                            >
                              <option value="">— nenhum —</option>
                              <option value="cliente">Cliente</option>
                              <option value="socio">Sócio</option>
                              <option value="contato">Contato</option>
                              <option value="endereco">Endereço</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Campo destino</Label>
                            <Input
                              value={campoAtual.mapping?.field ?? ""}
                              onChange={(e) => updateCampo(campoSelecionado!, {
                                mapping: { ...campoAtual.mapping, field: e.target.value }
                              })}
                              placeholder="ex: razaoSocial"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          Auto-preenche este atributo do cliente quando a equipe aplicar a resposta.
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Mostrar só se outro campo for igual a</Label>
                            <select
                              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                              value={campoAtual.showIf?.field ?? ""}
                              onChange={(e) => updateCampo(campoSelecionado!, {
                                showIf: e.target.value ? { field: e.target.value, equals: campoAtual.showIf?.equals ?? "" } : undefined
                              })}
                            >
                              <option value="">— sempre mostrar —</option>
                              {outrosCampos.map((f, i) => (
                                <option key={i} value={f.key}>{f.label} ({f.key})</option>
                              ))}
                            </select>
                          </div>
                          {campoAtual.showIf?.field && (
                            <div className="space-y-1">
                              <Label className="text-xs">Valor esperado</Label>
                              <Input
                                value={String(campoAtual.showIf.equals ?? "")}
                                onChange={(e) => updateCampo(campoSelecionado!, {
                                  showIf: { ...campoAtual.showIf!, equals: e.target.value }
                                })}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </details>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ============ PREVIEW ============ */}
        {previewAberto && (
          <div>
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4" /> Preview ao vivo
                </CardTitle>
                <CardDescription>Como o cliente vai ver</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-50 rounded-lg p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                  <div>
                    <h2 className="text-xl font-bold text-cestacorp-blue">
                      {form.title || "(título do formulário)"}
                    </h2>
                    {form.description && (
                      <p className="text-sm text-muted-foreground mt-1">{form.description}</p>
                    )}
                  </div>
                  {form.fields.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Adicione campos pra ver o preview
                    </p>
                  ) : (
                    form.fields.map((f, i) => <PreviewField key={i} field={f} />)
                  )}
                  {form.fields.length > 0 && (
                    <button
                      disabled
                      className="w-full bg-cestacorp-blue text-white rounded-md py-2 font-semibold opacity-80"
                    >
                      Enviar
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewField({ field }: { field: Field }) {
  const required = field.required ? <span className="text-red-500"> *</span> : null;
  if (field.type === "section") {
    return (
      <div className="border-b pb-1 pt-3">
        <h3 className="font-bold text-cestacorp-blue">{field.label}</h3>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium block">
        {field.label}{required}
      </label>
      {field.type === "textarea" ? (
        <textarea
          disabled
          className="w-full min-h-20 rounded-md border bg-white p-2 text-sm"
          placeholder={field.placeholder ?? ""}
        />
      ) : field.type === "select" ? (
        <select disabled className="h-10 w-full rounded-md border bg-white px-2 text-sm">
          <option>— selecione —</option>
          {(field.options ?? []).map((o, i) => <option key={i}>{o.label}</option>)}
        </select>
      ) : field.type === "multiselect" ? (
        <select disabled multiple className="w-full min-h-20 rounded-md border bg-white px-2 text-sm">
          {(field.options ?? []).map((o, i) => <option key={i}>{o.label}</option>)}
        </select>
      ) : field.type === "radio" ? (
        <div className="space-y-1">
          {(field.options ?? []).map((o, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <input type="radio" disabled name={field.key} /> {o.label}
            </label>
          ))}
        </div>
      ) : field.type === "checkbox" ? (
        <div className="space-y-1">
          {(field.options ?? []).map((o, i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <input type="checkbox" disabled /> {o.label}
            </label>
          ))}
        </div>
      ) : field.type === "file" ? (
        <input type="file" disabled className="block w-full text-xs" />
      ) : (
        <input
          type={
            field.type === "email" ? "email" :
            field.type === "date" ? "date" :
            field.type === "number" || field.type === "money" ? "number" :
            field.type === "phone" ? "tel" :
            "text"
          }
          disabled
          placeholder={field.placeholder ?? ""}
          className="h-10 w-full rounded-md border bg-white px-2 text-sm"
        />
      )}
      {field.helpText && (
        <p className="text-[11px] text-muted-foreground">{field.helpText}</p>
      )}
    </div>
  );
}
