"use client";
import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, CheckCircle2, AlertCircle, FileText } from "lucide-react";

type Resultado = {
  arquivo: string;
  chave?: string;
  criado?: boolean;
  vinculado?: boolean;
  notaId?: string;
  erro?: string;
};

export default function ImportarXmlPage() {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [resumo, setResumo] = useState<{ total: number; criadas: number; duplicadas: number; erros: number } | null>(null);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  async function enviar() {
    if (arquivos.length === 0) return;
    setEnviando(true);
    setResumo(null); setResultados([]);
    setProgresso(10);

    const fd = new FormData();
    for (const a of arquivos) fd.append("files", a);

    try {
      const r = await fetch("/api/notas-fiscais/importar", { method: "POST", body: fd });
      setProgresso(95);
      const j = await r.json();
      if (j?.resumo) setResumo(j.resumo);
      if (j?.resultados) setResultados(j.resultados);
    } finally {
      setProgresso(100);
      setEnviando(false);
    }
  }

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    const fs = Array.from(e.dataTransfer.files ?? []).filter((f) => f.name.toLowerCase().endsWith(".xml"));
    setArquivos((cur) => [...cur, ...fs]);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/notas-fiscais" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Notas Fiscais
      </Link>
      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <Upload className="h-7 w-7" /> Importar XML de NF-e
        </h1>
        <p className="text-muted-foreground">
          Envie múltiplos XMLs. Sistema extrai todos os dados (emitente, destinatário, itens, impostos)
          e vincula automaticamente ao cliente pelo CNPJ.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Arquivos</CardTitle>
          <CardDescription>Arraste os XMLs aqui ou clique para selecionar</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="block border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:border-cestacorp-blue hover:bg-cestacorp-blue/5 transition"
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Solte os arquivos .xml aqui</p>
            <p className="text-xs text-muted-foreground mt-1">
              Ou clique para selecionar · até <b>500 arquivos por lote</b>
            </p>
            <input
              type="file"
              multiple
              accept=".xml,application/xml,text/xml"
              onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
              className="hidden"
            />
          </label>

          {arquivos.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <p className="text-sm font-medium">{arquivos.length} arquivo{arquivos.length !== 1 ? "s" : ""} selecionado{arquivos.length !== 1 ? "s" : ""}</p>
              <ul className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                {arquivos.map((a, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <FileText className="h-3 w-3" /> {a.name} <span className="text-muted-foreground/60">({(a.size / 1024).toFixed(1)} KB)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {enviando && (
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cestacorp-blue to-cestacorp-green transition-all" style={{ width: `${progresso}%` }} />
            </div>
          )}

          <div className="flex justify-end gap-2">
            {arquivos.length > 0 && !enviando && (
              <Button variant="ghost" onClick={() => setArquivos([])}>Limpar</Button>
            )}
            <Button onClick={enviar} disabled={arquivos.length === 0 || enviando}>
              <Upload className="h-4 w-4" /> {enviando ? "Importando…" : `Importar ${arquivos.length} XML${arquivos.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {resumo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Importação concluída
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              <Mini label="Total" value={resumo.total} color="slate" />
              <Mini label="Criadas" value={resumo.criadas} color="emerald" />
              <Mini label="Duplicadas" value={resumo.duplicadas} color="amber" />
              <Mini label="Erros" value={resumo.erros} color="red" />
            </div>
            {resultados.length > 0 && (
              <ul className="border rounded-md divide-y max-h-80 overflow-y-auto">
                {resultados.map((r, i) => (
                  <li key={i} className="p-3 flex items-start gap-3 text-sm">
                    {r.erro ? (
                      <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    ) : r.criado ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{r.arquivo}</p>
                      {r.chave && <p className="text-[10px] font-mono text-muted-foreground">{r.chave}</p>}
                      {r.erro && <p className="text-xs text-red-700 mt-0.5">{r.erro}</p>}
                      {!r.erro && !r.criado && <p className="text-xs text-amber-700 mt-0.5">Já importada anteriormente</p>}
                      {r.criado && !r.vinculado && <p className="text-xs text-amber-700 mt-0.5">Cliente não identificado pelo CNPJ</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: number; color: "slate" | "emerald" | "amber" | "red" }) {
  const classes = {
    slate: "bg-slate-50 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className={"rounded-md p-3 text-center " + classes[color]}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] uppercase font-semibold tracking-wider">{label}</p>
    </div>
  );
}
