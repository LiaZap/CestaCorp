"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Send, Copy, MessageCircle, Mail, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface FormDef {
  id: string;
  slug: string;
  title: string;
  category: string;
  active: boolean;
}

interface Props {
  preCadastroId: string;
  nomeContato: string;
  emailContato: string;
  telefoneContato: string | null;
}

export function EnviarFormularioCard({ preCadastroId, nomeContato, emailContato, telefoneContato }: Props) {
  const [forms, setForms] = useState<FormDef[]>([]);
  const [formSlug, setFormSlug] = useState<string>("");

  useEffect(() => {
    fetch("/api/forms/definitions?ativo=1", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d: FormDef[]) => {
        const ativos = (d ?? []).filter((f) => f.active);
        setForms(ativos);
        if (ativos.length > 0 && !formSlug) setFormSlug(ativos[0].slug);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const origin = typeof window !== "undefined" ? window.location.origin : "https://cestacorp.bahflash.tech";
  const link = formSlug ? `${origin}/forms/${formSlug}?pre=${preCadastroId}` : "";

  function copiar() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado");
  }

  function abrirWhatsApp() {
    if (!link) return;
    const tel = (telefoneContato ?? "").replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Olá ${nomeContato}, segue o link pra você preencher o cadastro com a Cestacorp: ${link}`,
    );
    const url = tel
      ? `https://wa.me/55${tel}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(url, "_blank");
  }

  function abrirEmail() {
    if (!link || !emailContato) return;
    const subj = encodeURIComponent("Cadastro Cestacorp — preencher dados");
    const body = encodeURIComponent(
      `Olá ${nomeContato},\n\nSegue o link pra preencher seu cadastro:\n${link}\n\nAo enviar, os dados ficam automaticamente vinculados ao seu pré-cadastro conosco.\n\nObrigado.`,
    );
    window.open(`mailto:${emailContato}?subject=${subj}&body=${body}`, "_blank");
  }

  if (forms.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" /> Enviar formulário</CardTitle>
          <CardDescription>Nenhum formulário ativo. Crie em <a href="/formularios/definitions" className="underline">/formularios/definitions</a>.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" /> Enviar formulário</CardTitle>
        <CardDescription>
          Link já vem com <code>?pre={preCadastroId.slice(0, 8)}…</code> — a resposta vincula automaticamente a este pré-cadastro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label>Formulário</Label>
          <select
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={formSlug}
            onChange={(e) => setFormSlug(e.target.value)}
          >
            {forms.map((f) => (
              <option key={f.id} value={f.slug}>{f.title} ({f.category})</option>
            ))}
          </select>
        </div>

        {link && (
          <>
            <div className="space-y-1">
              <Label>Link</Label>
              <div className="flex items-center gap-1 bg-muted rounded px-3 py-2 text-xs font-mono break-all">
                <span className="flex-1">{link}</span>
                <Button variant="ghost" size="icon" onClick={copiar} aria-label="Copiar link">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button asChild variant="ghost" size="icon" aria-label="Abrir no navegador">
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={abrirWhatsApp} variant="outline" className="flex-1" disabled={!telefoneContato}>
                <MessageCircle className="h-4 w-4 text-emerald-600" /> Mandar no WhatsApp
              </Button>
              <Button onClick={abrirEmail} variant="outline" className="flex-1" disabled={!emailContato}>
                <Mail className="h-4 w-4 text-blue-600" /> Mandar por e-mail
              </Button>
            </div>
            {!telefoneContato && (
              <p className="text-[10px] text-muted-foreground">Adicione um telefone ao pré-cadastro pra usar WhatsApp.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
