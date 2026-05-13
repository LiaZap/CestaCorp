"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Play, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import { formatCpfCnpj } from "@/lib/utils";

type Cliente = { id: string; razaoSocial: string; cpfCnpj: string; classificacao: string | null; qtdContratos: number };
type Template = { id: string; nome: string; tipo: string };
type Resultado = {
  id: string;
  razaoSocial: string;
  sucesso: boolean;
  contratoId?: string;
  erro?: string;
};

export function BatchContratoForm({ clientes, templates }: { clientes: Cliente[]; templates: Template[] }) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [busca, setBusca] = useState("");
  const [filtroClass, setFiltroClass] = useState("");
  const [soSemContrato, setSoSemContrato] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [executando, setExecutando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [resultados, setResultados] = useState<Resultado[]>([]);

  const visiveis = useMemo(() => {
    const q = busca.toLowerCase();
    return clientes.filter((c) => {
      if (filtroClass && c.classificacao !== filtroClass) return false;
      if (soSemContrato && c.qtdContratos > 0) return false;
      if (!q) return true;
      return c.razaoSocial.toLowerCase().includes(q) || c.cpfCnpj.includes(q);
    });
  }, [clientes, busca, filtroClass, soSemContrato]);

  function toggle(id: string) {
    setSelecionados((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAll() {
    if (selecionados.size === visiveis.length) setSelecionados(new Set());
    else setSelecionados(new Set(visiveis.map((c) => c.id)));
  }

  async function executar() {
    if (!templateId || selecionados.size === 0) return;
    setExecutando(true);
    setResultados([]);
    setProgresso(0);

    const ids = Array.from(selecionados);
    // gera um a um para poder mostrar progresso (falhas não abortam o batch)
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const cliente = clientes.find((c) => c.id === id)!;
      try {
        const res = await fetch("/api/contratos/gerar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ clienteId: id, templateId }),
        });
        const json = await res.json();
        setResultados((r) => [...r, {
          id, razaoSocial: cliente.razaoSocial,
          sucesso: res.ok,
          contratoId: json.contratoId,
          erro: res.ok ? undefined : (json.error ?? "Erro"),
        }]);
      } catch (err: any) {
        setResultados((r) => [...r, { id, razaoSocial: cliente.razaoSocial, sucesso: false, erro: String(err?.message ?? err) }]);
      }
      setProgresso(Math.round(((i + 1) / ids.length) * 100));
    }
    setExecutando(false);
  }

  const sucessos = resultados.filter((r) => r.sucesso).length;
  const falhas = resultados.filter((r) => !r.sucesso).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Escolha o template</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="h-10 w-full max-w-md rounded-md border bg-background px-3 text-sm"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.nome} — {t.tipo}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Selecione os clientes</CardTitle>
          <CardDescription>{selecionados.size} de {visiveis.length} selecionados</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className="pl-9" />
            </div>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={filtroClass}
              onChange={(e) => setFiltroClass(e.target.value)}
            >
              <option value="">Todas classificações</option>
              <option value="BRONZE">Bronze</option>
              <option value="PRATA">Prata</option>
              <option value="OURO">Ouro</option>
              <option value="TOP">Top</option>
            </select>
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={soSemContrato} onChange={(e) => setSoSemContrato(e.target.checked)} />
              Só sem contrato
            </label>
          </div>

          <div className="border rounded-md max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b z-10">
                <tr>
                  <th className="p-2 text-left w-8">
                    <input
                      type="checkbox"
                      checked={visiveis.length > 0 && selecionados.size === visiveis.length}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="p-2 text-left">Razão social</th>
                  <th className="p-2 text-left">CPF/CNPJ</th>
                  <th className="p-2 text-left">Classif.</th>
                  <th className="p-2 text-left">Contratos</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/50 cursor-pointer" onClick={() => toggle(c.id)}>
                    <td className="p-2"><input type="checkbox" checked={selecionados.has(c.id)} onChange={() => toggle(c.id)} /></td>
                    <td className="p-2">{c.razaoSocial}</td>
                    <td className="p-2 font-mono text-xs">{formatCpfCnpj(c.cpfCnpj)}</td>
                    <td className="p-2">{c.classificacao ?? "—"}</td>
                    <td className="p-2">{c.qtdContratos}</td>
                  </tr>
                ))}
                {visiveis.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum cliente nos filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Executar</CardTitle>
          <CardDescription>
            Gera 1 contrato .docx por cliente selecionado. Falhas não interrompem os demais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            size="lg"
            onClick={executar}
            disabled={!templateId || selecionados.size === 0 || executando}
          >
            <Play className="h-4 w-4" />
            {executando ? `Gerando ${progresso}%…` : `Gerar ${selecionados.size} contrato(s)`}
          </Button>

          {executando && (
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${progresso}%` }} />
            </div>
          )}

          {resultados.length > 0 && (
            <div className="space-y-3">
              <div className="flex gap-3 text-sm">
                <span className="status-badge status-pago"><CheckCircle2 className="h-3 w-3 mr-1" /> {sucessos} sucesso</span>
                {falhas > 0 && <span className="status-badge status-erro"><AlertTriangle className="h-3 w-3 mr-1" /> {falhas} falhas</span>}
              </div>

              <ul className="max-h-80 overflow-y-auto divide-y border rounded-md">
                {resultados.map((r) => (
                  <li key={r.id} className="p-3 flex items-center justify-between gap-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{r.razaoSocial}</p>
                      {r.erro && <p className="text-xs text-red-600 truncate">{r.erro}</p>}
                    </div>
                    {r.sucesso && r.contratoId ? (
                      <Link href={`/api/contratos/${r.contratoId}/pdf`} target="_blank" rel="noopener noreferrer"
                        className="text-primary text-xs hover:underline inline-flex items-center gap-1">
                        <FileText className="h-3 w-3" /> baixar
                      </Link>
                    ) : (
                      <span className="text-xs text-red-600">✗</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
