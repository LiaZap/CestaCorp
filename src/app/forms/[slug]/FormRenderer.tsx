"use client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, CheckCircle2, X } from "lucide-react";

function UploadField({ value, onChange, label, required }: {
  value: any; onChange: (v: any) => void; label: string; required?: boolean;
}) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const uploaded = value && typeof value === "object" && value.url;

  async function onFile(file: File | null) {
    if (!file) return;
    setEnviando(true); setErro(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "erro");
      onChange({ nome: file.name, url: j.url, id: j.id, mime: j.mime, tamanho: j.tamanho });
    } catch (e: any) {
      setErro(String(e?.message ?? e));
    } finally {
      setEnviando(false);
    }
  }

  if (uploaded) {
    return (
      <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-md">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{value.nome}</p>
          <p className="text-xs text-emerald-700">{(value.tamanho / 1024).toFixed(1)} KB · enviado</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="text-muted-foreground hover:text-destructive" aria-label="Remover">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <label className="flex flex-col items-center justify-center gap-2 p-5 border-2 border-dashed rounded-md cursor-pointer hover:border-cestacorp-blue transition">
      <Upload className="h-6 w-6 text-muted-foreground" />
      <span className="text-sm font-medium text-center">
        {enviando ? "Enviando…" : `Anexar ${label.toLowerCase()}`}
      </span>
      <span className="text-[11px] text-muted-foreground">PNG, JPG, PDF até 15MB</span>
      <input
        type="file"
        required={required}
        disabled={enviando}
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        className="hidden"
        accept="image/*,application/pdf"
      />
      {erro && <span className="text-xs text-destructive mt-1">{erro}</span>}
    </label>
  );
}

type Field = {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  helpText?: string;
  placeholder?: string;
  options?: { label: string; value: string }[];
  showIf?: { field: string; equals: any };
};

export function FormRenderer({ slug, fields }: { slug: string; fields: Field[] }) {
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const visibleFields = useMemo(() => {
    return fields.filter((f) => {
      if (!f.showIf) return true;
      return answers[f.showIf.field] === f.showIf.equals;
    });
  }, [fields, answers]);

  function set(key: string, value: any) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true); setErro(null);
    const res = await fetch(`/api/forms/${slug}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers, autor: { nome, email, telefone } }),
    });
    setEnviando(false);
    if (res.ok) setOk(true);
    else setErro((await res.json()).error || "Erro ao enviar");
  }

  if (ok) {
    return (
      <div className="rounded-md bg-green-50 p-6 text-center">
        <p className="text-lg font-medium text-green-800">Recebemos seu formulário!</p>
        <p className="text-sm text-green-700 mt-1">A equipe Cestacorp entrará em contato em breve.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-5">
        <div className="space-y-1">
          <Label>Seu nome *</Label>
          <Input required value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>E-mail *</Label>
          <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label>Telefone</Label>
          <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        </div>
      </div>

      {visibleFields.map((f) => {
        if (f.type === "section") {
          return <h3 key={f.key} className="text-sm font-semibold text-cestacorp-blue uppercase mt-4">{f.label}</h3>;
        }
        return (
          <div key={f.key} className="space-y-1">
            <Label>{f.label}{f.required && " *"}</Label>
            {f.type === "textarea" ? (
              <textarea
                required={f.required}
                className="w-full min-h-24 rounded-md border bg-background p-3 text-sm"
                placeholder={f.placeholder}
                value={answers[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
              />
            ) : f.type === "select" || f.type === "radio" ? (
              <select
                required={f.required}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={answers[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
              >
                <option value="">Selecione…</option>
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.type === "checkbox" ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!answers[f.key]} onChange={(e) => set(f.key, e.target.checked)} />
                {f.placeholder || "Sim"}
              </label>
            ) : f.type === "file" ? (
              <UploadField value={answers[f.key]} onChange={(v) => set(f.key, v)} label={f.label} required={f.required} />
            ) : (
              <Input
                required={f.required}
                type={f.type === "email" ? "email" : f.type === "date" ? "date" : f.type === "number" || f.type === "money" ? "number" : "text"}
                placeholder={f.placeholder}
                value={answers[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
            {f.helpText && <p className="text-xs text-muted-foreground">{f.helpText}</p>}
          </div>
        );
      })}

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={enviando}>
          {enviando ? "Enviando…" : "Enviar formulário"}
        </Button>
      </div>
    </form>
  );
}
