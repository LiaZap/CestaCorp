"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, AlertCircle, FileSignature, Sparkles, Filter, Play, ShieldCheck,
} from "lucide-react";

type Template = {
  id: string;
  nome: string;
  tipo: string;
  versao: string | null;
  lgpdAtual: boolean;
};

type Cobertura = { templateId: string; total: number; cobertos: number; faltam: number };

type Filtro = {
  status: "ATIVO" | "INATIVO" | "PROSPECT";
  classificacao: string[];
  tags: string[];
  semContratoDeste: boolean;
};

type Resultado = {
  ok: boolean;
  total: number;
  gerados: number;
  pulados: number;
  erros: number;
  resultados: { clienteId: string; ok: boolean; contratoId?: string; valor?: number; motivo?: string; anexos?: string[] }[];
};

export function LoteLgpdClient({
  templates,
  cobertura,
}: {
  templates: Template[];
  cobertura: Cobertura[];
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState<string>(templates.find((t) => t.lgpdAtual)?.id ?? templates[0]?.id ?? "");
  const [filtro, setFiltro] = useState<Filtro>({
    status: "ATIVO",
    classificacao: [],
    tags: [],
    semContratoDeste: true,
  });
  const [emitir, setEmitir] = useState(true);
  const [forcar, setForcar] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const cob = cobertura.find((c) => c.templateId === templateId);

  function toggleClass(c: string) {
    const set = new Set(filtro.classificacao);
    if (set.has(c)) set.delete(c);
    else set.add(c);
    setFiltro({ ...filtro, classificacao: Array.from(set) });
  }

  async function executar() {
    if (!templateId) {
      setErro("Selecione um template.");
      return;
    }
    if (!confirm(
      `Vou gerar contratos pra clientes ATIVOS${
        filtro.semContratoDeste ? " que ainda NÃO têm este template" : ""
      }${
        filtro.classificacao.length ? ` (${filtro.classificacao.join(", ")})` : ""
      }.\n\nDeseja prosseguir?`
    )) return;

    setLoading(true); setErro(null); setResultado(null);
    try {
      const r = await fetch("/api/contratos/gerar-lote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId,
          filtro,
          forcar,
          emitir,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setErro(typeof j.error === "string" ? j.error : "erro");
        return;
      }
      setResultado(j);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" /> 1. Escolha o template
          </CardTitle>
          <CardDescription>
            Templates marcados com <b>LGPD ATUAL</b> são os preferenciais para regularização.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {templates.map((t) => {
              const c = cobertura.find((x) => x.templateId === t.id);
              return (
                <label
                  key={t.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    templateId === t.id
                      ? "border-cestacorp-blue bg-cestacorp-blue/5 ring-2 ring-cestacorp-blue/20"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="template"
                    checked={templateId === t.id}
                    onChange={() => setTemplateId(t.id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{t.nome}</p>
                      {t.lgpdAtual && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                          <ShieldCheck className="h-3 w-3" /> LGPD ATUAL
                        </span>
                      )}
                      {t.versao && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                          {t.versao}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{t.tipo}</p>
                  </div>
                  {c && (
                    <div className="text-right text-xs">
                      <p className="font-semibold">{c.cobertos}/{c.total}</p>
                      <p className="text-muted-foreground">{c.faltam} sem contrato</p>
                    </div>
                  )}
                </label>
              );
            })}
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhum template ativo. Crie em <code>/contratos/templates/novo</code>.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" /> 2. Filtre os clientes
          </CardTitle>
          <CardDescription>
            Default: clientes ATIVOS que ainda não têm este template (regulariza só quem precisa).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wider mb-1">Classificação</p>
            <div className="flex flex-wrap gap-2">
              {["BRONZE", "PRATA", "OURO", "TOP"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleClass(c)}
                  className={`text-xs px-3 py-1 rounded-full border transition ${
                    filtro.classificacao.includes(c)
                      ? "bg-cestacorp-blue text-white border-cestacorp-blue"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {c}
                </button>
              ))}
              <span className="text-xs text-muted-foreground self-center ml-2">
                {filtro.classificacao.length === 0 ? "(nenhum filtro = todos)" : ""}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filtro.semContratoDeste}
                onChange={(e) => setFiltro({ ...filtro, semContratoDeste: e.target.checked })}
              />
              Só clientes que <b>ainda não têm</b> contrato deste template (recomendado)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={emitir}
                onChange={(e) => setEmitir(e.target.checked)}
              />
              Marcar como <b>EMITIDO</b> (em vez de RASCUNHO)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={forcar}
                onChange={(e) => setForcar(e.target.checked)}
              />
              <span>
                <b>Forçar regeração</b> mesmo se cliente já tem contrato deste template
                <span className="text-xs text-muted-foreground ml-2">(cuidado — pode duplicar)</span>
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> 3. O que vai acontecer
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>✓ Para cada cliente filtrado, gera um <b>.docx</b> usando o template selecionado</p>
          <p>✓ <b>Valor de honorário</b> = última recorrência ativa (vinda do NIBO via Honorário)</p>
          <p>✓ <b>Anexos</b> com auto-aplicação por tag são incluídos automaticamente</p>
          <p>✓ <b>Sócios assinantes</b> são listados nos placeholders</p>
          <p>✓ Operação é <b>idempotente</b> — pula clientes que já têm contrato (a menos que marque "forçar")</p>
          {cob && (
            <div className="mt-4 p-3 rounded-md bg-blue-50 border border-blue-200">
              <p className="text-blue-900">
                <b>Estimativa:</b> {cob.faltam} contrato{cob.faltam !== 1 ? "s" : ""} {filtro.semContratoDeste ? "serão gerados" : "potencialmente afetados"}
                {filtro.classificacao.length > 0 && " (filtrados por classificação)"}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {erro && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {erro}
        </div>
      )}

      {resultado && (
        <Card className="border-emerald-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> Lote concluído
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3 text-sm mb-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{resultado.total}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Gerados</p>
                <p className="text-2xl font-bold text-emerald-600">{resultado.gerados}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pulados</p>
                <p className="text-2xl font-bold text-amber-600">{resultado.pulados}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Erros</p>
                <p className="text-2xl font-bold text-red-600">{resultado.erros}</p>
              </div>
            </div>
            {resultado.erros > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                  Ver erros ({resultado.erros})
                </summary>
                <ul className="mt-2 space-y-1 font-mono">
                  {resultado.resultados.filter((r) => !r.ok).slice(0, 20).map((r, i) => (
                    <li key={i}>
                      <span className="text-muted-foreground">{r.clienteId.slice(0, 8)}…:</span> {r.motivo}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={executar} disabled={loading || !templateId} size="lg">
          <Play className="h-4 w-4" /> {loading ? "Gerando lote… (pode levar 2-5 min)" : "Executar geração em lote"}
        </Button>
      </div>
    </div>
  );
}
