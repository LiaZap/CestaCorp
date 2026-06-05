"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Download, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "@/lib/toast";

export function RenomearLoteClient() {
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resumo, setResumo] = useState<{ total: number; ok: number; parcial: number; erro: number } | null>(null);

  function onDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    const fs = Array.from(e.dataTransfer.files ?? []).filter((f) =>
      f.name.toLowerCase().endsWith(".pdf")
    );
    setArquivos((cur) => [...cur, ...fs].slice(0, 30));
  }

  async function enviar() {
    if (arquivos.length === 0) return;
    setEnviando(true);
    setResumo(null);
    setProgresso(15);

    const fd = new FormData();
    for (const a of arquivos) fd.append("files", a);

    try {
      const r = await fetch("/api/notas-fiscais/renomear", { method: "POST", body: fd });
      setProgresso(85);
      if (!r.ok) {
        const txt = await r.text();
        try {
          const j = JSON.parse(txt);
          toast.error(j.error || "Erro ao processar");
        } catch {
          toast.error("Erro ao processar");
        }
        setEnviando(false);
        return;
      }

      // Resposta é o ZIP — baixa direto
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = r.headers.get("content-disposition") || "";
      const m = cd.match(/filename="?([^"]+)"?/);
      a.download = m?.[1] ?? `notas-renomeadas-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgresso(100);
      setResumo({ total: arquivos.length, ok: arquivos.length, parcial: 0, erro: 0 });
      toast.success(`ZIP baixado com ${arquivos.length} arquivos renomeados`);
      setArquivos([]);
    } catch (e: any) {
      toast.error(`Falha: ${String(e?.message ?? e).slice(0, 100)}`);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Arquivos</CardTitle>
          <CardDescription>
            Arraste os PDFs aqui ou clique para selecionar · até <b>30 arquivos por lote</b>, 10MB cada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="block border-2 border-dashed rounded-xl p-10 text-center cursor-pointer hover:border-cestacorp-blue hover:bg-cestacorp-blue/5 transition"
          >
            <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Solte os PDFs aqui</p>
            <p className="text-xs text-muted-foreground mt-1">Ou clique pra selecionar</p>
            <input
              type="file"
              multiple
              accept="application/pdf,.pdf"
              onChange={(e) => setArquivos(Array.from(e.target.files ?? []).slice(0, 30))}
              className="hidden"
            />
          </label>

          {arquivos.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <p className="text-sm font-medium">
                {arquivos.length} arquivo{arquivos.length !== 1 ? "s" : ""} selecionado{arquivos.length !== 1 ? "s" : ""}
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 max-h-48 overflow-y-auto">
                {arquivos.map((a, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <FileText className="h-3 w-3" /> {a.name}{" "}
                    <span className="text-muted-foreground/60">({(a.size / 1024).toFixed(1)} KB)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {enviando && (
            <div className="space-y-2">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cestacorp-blue to-cestacorp-green transition-all"
                  style={{ width: `${progresso}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Extraindo dados via OCR (Claude vision)... pode demorar ~3s por PDF.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            {arquivos.length > 0 && !enviando && (
              <Button variant="ghost" onClick={() => setArquivos([])}>
                Limpar
              </Button>
            )}
            <Button onClick={enviar} disabled={arquivos.length === 0 || enviando}>
              <Download className="h-4 w-4" />
              {enviando ? "Processando…" : `Renomear ${arquivos.length} PDF${arquivos.length !== 1 ? "s" : ""} → baixar ZIP`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {resumo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Lote processado
            </CardTitle>
            <CardDescription>
              {resumo.total} arquivos · {resumo.ok} renomeados com sucesso
              {resumo.parcial > 0 && ` · ${resumo.parcial} parciais`}
              {resumo.erro > 0 && ` · ${resumo.erro} com erro`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              O ZIP contém <code>relatorio.csv</code> detalhando cada arquivo (tomador identificado, CNPJ, data, status).
              Se algum PDF veio só com data ou só com tomador, foi nomeado com o que conseguiu identificar.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
