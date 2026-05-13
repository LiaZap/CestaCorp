"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, CheckCircle2 } from "lucide-react";

const SLUGS = [
  { slug: "abertura-empresa", title: "Abertura de Empresa", category: "abertura-empresa" },
  { slug: "alteracao-empresa", title: "Alteração de Empresa", category: "alteracao-empresa" },
  { slug: "abertura-mei", title: "Abertura MEI", category: "abertura-mei" },
  { slug: "alteracao-mei", title: "Alteração MEI", category: "alteracao-mei" },
  { slug: "socios", title: "Dados dos Sócios", category: "socios" },
  { slug: "carne-leao", title: "Carnê Leão", category: "carne-leao" },
  { slug: "esocial-domestico", title: "eSocial Doméstico", category: "esocial-domestico" },
  { slug: "gps-avulsa", title: "GPS Avulsa", category: "gps-avulsa" },
];

type Resultado = { slug: string; totalLinhas: number; importadas: number; duplicadas: number; criouDefinition: boolean };

export default function ImportarGoogleFormsPage() {
  const [slug, setSlug] = useState(SLUGS[0].slug);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) return;
    setLoading(true); setErro(null); setRes(null);
    const meta = SLUGS.find((s) => s.slug === slug)!;
    const form = new FormData();
    form.append("file", arquivo);
    form.append("slug", slug);
    form.append("title", meta.title);
    form.append("category", meta.category);
    const r = await fetch("/api/forms/importar-google", { method: "POST", body: form });
    const json = await r.json();
    setLoading(false);
    if (!r.ok) setErro(json.error || "Erro"); else setRes(json.result);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue">Importar respostas antigas do Google Forms</h1>
        <p className="text-muted-foreground">
          Carregue as planilhas <code>.xlsx</code> exportadas dos Google Forms. Respostas são guardadas
          com a flag <code>origem: import-google</code> preservando a data original.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload</CardTitle>
          <CardDescription>Uma planilha por vez — selecione o formulário correspondente.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={enviar} className="space-y-4">
            <div className="space-y-1">
              <Label>Formulário</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              >
                {SLUGS.map((s) => <option key={s.slug} value={s.slug}>{s.title}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Planilha (.xlsx exportada do Google Forms)</Label>
              <input
                type="file"
                accept=".xlsx"
                required
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:px-4 file:py-2 file:font-medium"
              />
            </div>
            <Button type="submit" disabled={!arquivo || loading}>
              <Upload className="h-4 w-4" /> {loading ? "Importando…" : "Importar"}
            </Button>
          </form>

          {erro && <p className="mt-4 text-sm text-destructive">{erro}</p>}

          {res && (
            <div className="mt-4 rounded-md bg-green-50 border border-green-200 p-4 text-sm space-y-1">
              <p className="flex items-center gap-2 font-medium text-green-800">
                <CheckCircle2 className="h-4 w-4" /> Importação concluída
              </p>
              <p>Slug: <b>{res.slug}</b></p>
              <p>Linhas processadas: {res.totalLinhas}</p>
              <p className="text-green-700">Importadas: <b>{res.importadas}</b></p>
              <p className="text-amber-700">Duplicadas (já existiam): {res.duplicadas}</p>
              {res.criouDefinition && <p className="text-blue-700">FormDefinition criada automaticamente.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
