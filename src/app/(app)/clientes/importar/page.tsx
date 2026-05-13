"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";

type AbaResult = {
  aba: string;
  ok: boolean;
  novos: number;
  atualizados: number;
  ignorados: number;
  detalhes?: { linha: number; razao?: string; motivo: string }[];
  erro?: string;
};

type Resultado = {
  ok: boolean;
  resumo: { totalNovos: number; totalAtualizados: number; totalIgnorados: number };
  abas: AbaResult[];
};

const ABAS_PROCESSADAS = [
  { nome: "CLIENTES", desc: "Cadastro principal, classificação, regime, responsáveis" },
  { nome: "EMAILS", desc: "Contatos de e-mail e telefones por cliente" },
  { nome: "TAGS HUBLX", desc: "Mapeamento Marlon: regime, folha, segmento, etc." },
  { nome: "ANIVERSARIANTES", desc: "Aniversário dos sócios" },
];

export default function ImportarClientesPage() {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    if (!arquivo) return;
    setLoading(true); setErro(null); setResultado(null);
    const form = new FormData();
    form.append("file", arquivo);
    try {
      const res = await fetch("/api/clientes/importar", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error || "Falha ao importar");
      } else {
        setResultado(json);
      }
    } catch (e: any) {
      setErro(String(e?.message ?? e).slice(0, 200));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <FileSpreadsheet className="h-7 w-7" /> Importar planilha V106
        </h1>
        <p className="text-muted-foreground">
          Carregue a planilha <code>CONTROLE CESTACORP.xlsx</code> completa. O sistema processa 4 abas
          em sequência e é idempotente — pode rodar várias vezes sem duplicar registros.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>O que será importado</CardTitle>
          <CardDescription>4 abas processadas em ordem</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {ABAS_PROCESSADAS.map((a, i) => (
              <li key={a.nome} className="flex gap-3 text-sm">
                <span className="shrink-0 h-6 w-6 rounded-full bg-cestacorp-blue/10 text-cestacorp-blue flex items-center justify-center font-bold text-xs">
                  {i + 1}
                </span>
                <div>
                  <p className="font-semibold">{a.nome}</p>
                  <p className="text-xs text-muted-foreground">{a.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Upload</CardTitle>
          <CardDescription>Somente .xlsx</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:px-4 file:py-2 file:font-medium"
          />
          {arquivo && (
            <p className="text-xs text-muted-foreground">
              Arquivo: <span className="font-mono">{arquivo.name}</span> ({(arquivo.size / 1024 / 1024).toFixed(1)} MB)
            </p>
          )}
          <Button onClick={enviar} disabled={!arquivo || loading} size="lg">
            <Upload className="h-4 w-4" /> {loading ? "Importando… (pode levar 1-3 min)" : "Importar planilha completa"}
          </Button>
          {erro && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {erro}
            </div>
          )}
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> Importação concluída
            </CardTitle>
            <CardDescription>
              {resultado.resumo.totalNovos.toLocaleString("pt-BR")} novos ·{" "}
              {resultado.resumo.totalAtualizados.toLocaleString("pt-BR")} atualizados ·{" "}
              {resultado.resumo.totalIgnorados.toLocaleString("pt-BR")} ignorados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {resultado.abas.map((a) => (
                <li key={a.aba} className="py-3 flex items-start gap-3">
                  {a.ok ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-semibold">{a.aba}</p>
                    {a.ok ? (
                      <p className="text-xs text-muted-foreground">
                        {a.novos} novos · {a.atualizados} atualizados · {a.ignorados} ignorados
                      </p>
                    ) : (
                      <p className="text-xs text-red-600">{a.erro}</p>
                    )}
                    {a.detalhes && a.detalhes.length > 0 && (
                      <details className="mt-2 text-[11px]">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          Ver linhas com problema ({a.detalhes.length})
                        </summary>
                        <ul className="mt-1 ml-4 space-y-0.5 font-mono">
                          {a.detalhes.map((d, i) => (
                            <li key={i}>L{d.linha}{d.razao ? ` (${d.razao})` : ""}: {d.motivo}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
