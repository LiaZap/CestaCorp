"use client";

/**
 * Filtros multi-coluna pra /clientes — Patrick (call 18/05 + chat 13/06):
 *   "filtros e busca pra melhorar e auxiliar no dia a dia".
 *
 * Padrão de UX:
 *  - Barra compacta sempre visível (busca + status + classificação + botão "+")
 *  - Expansão "Mais filtros" revela tributação, prefeitura, segmento, responsável,
 *    sede virtual, avaliação google, folha, inadimplência, ordenação.
 *  - URL é a fonte de verdade — botão Aplicar reescreve a URL.
 *  - Favoritos no localStorage (não usa DB pra não criar tabela auxiliar pra isso).
 *  - Pílulas mostram filtros ativos com X individual.
 *  - Botão "Limpar tudo" remove todos.
 */

import { useState, useTransition, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, ChevronUp, X, Star, Bookmark, CornerDownLeft } from "lucide-react";

interface Opcoes {
  tributacoes: string[];
  prefeituras: string[];
  segmentos: string[];
  responsaveis: string[];
}

interface Valores {
  q: string;
  status: string[];
  classificacao: string[];
  tributacao: string;
  prefeitura: string;
  segmento: string;
  responsavel: string;
  inadimplencia: string;
  sedeVirtual: string;
  avaliacaoGoogle: string;
  folha: string;
  ordenar: string;
}

const STATUS_OPCOES = ["ATIVO", "INATIVO", "ENCERRADO", "PROSPECT", "SUSPENSO"];
const CLASSIF_OPCOES = ["BRONZE", "PRATA", "OURO", "DIAMANTE", "TOP"];

const FAVORITOS_KEY = "cestacorp:clientes:filtros-favoritos";

export function FiltrosClientes({ valores, opcoes }: { valores: Valores; opcoes: Opcoes }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const [aberto, setAberto] = useState(false);
  const [v, setV] = useState<Valores>(valores);

  const algumFiltro = useMemo(() => {
    return Boolean(
      v.q ||
      v.status.length ||
      v.classificacao.length ||
      v.tributacao ||
      v.prefeitura ||
      v.segmento ||
      v.responsavel ||
      v.inadimplencia !== "todos" ||
      v.sedeVirtual !== "todos" ||
      v.avaliacaoGoogle !== "todos" ||
      v.folha !== "todos"
    );
  }, [v]);

  function montarUrl(vv: Valores): string {
    const usp = new URLSearchParams();
    if (vv.q) usp.set("q", vv.q);
    if (vv.status.length) usp.set("status", vv.status.join(","));
    if (vv.classificacao.length) usp.set("classificacao", vv.classificacao.join(","));
    if (vv.tributacao) usp.set("tributacao", vv.tributacao);
    if (vv.prefeitura) usp.set("prefeitura", vv.prefeitura);
    if (vv.segmento) usp.set("segmento", vv.segmento);
    if (vv.responsavel) usp.set("responsavel", vv.responsavel);
    if (vv.inadimplencia && vv.inadimplencia !== "todos") usp.set("inadimplencia", vv.inadimplencia);
    if (vv.sedeVirtual && vv.sedeVirtual !== "todos") usp.set("sedeVirtual", vv.sedeVirtual);
    if (vv.avaliacaoGoogle && vv.avaliacaoGoogle !== "todos") usp.set("avaliacaoGoogle", vv.avaliacaoGoogle);
    if (vv.folha && vv.folha !== "todos") usp.set("folha", vv.folha);
    if (vv.ordenar && vv.ordenar !== "razao") usp.set("ordenar", vv.ordenar);
    return usp.toString();
  }

  function aplicar() {
    const qs = montarUrl(v);
    start(() => router.push("/clientes" + (qs ? `?${qs}` : "")));
  }

  function limpar() {
    setV({
      q: "",
      status: [],
      classificacao: [],
      tributacao: "",
      prefeitura: "",
      segmento: "",
      responsavel: "",
      inadimplencia: "todos",
      sedeVirtual: "todos",
      avaliacaoGoogle: "todos",
      folha: "todos",
      ordenar: "razao",
    });
    start(() => router.push("/clientes"));
  }

  function toggleArr(campo: "status" | "classificacao", valor: string) {
    setV((cur) => {
      const arr = cur[campo];
      return { ...cur, [campo]: arr.includes(valor) ? arr.filter((x) => x !== valor) : [...arr, valor] };
    });
  }

  // Favoritos
  const [favoritos, setFavoritos] = useState<Array<{ nome: string; qs: string }>>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(FAVORITOS_KEY) ?? "[]"); } catch { return []; }
  });

  function salvarFavorito() {
    const nome = prompt("Nome do filtro favorito:")?.trim();
    if (!nome) return;
    const qs = montarUrl(v);
    const novos = [...favoritos.filter((f) => f.nome !== nome), { nome, qs }];
    setFavoritos(novos);
    try { localStorage.setItem(FAVORITOS_KEY, JSON.stringify(novos)); } catch {}
  }

  function carregarFavorito(qs: string) {
    start(() => router.push("/clientes" + (qs ? `?${qs}` : "")));
  }

  function removerFavorito(nome: string) {
    const novos = favoritos.filter((f) => f.nome !== nome);
    setFavoritos(novos);
    try { localStorage.setItem(FAVORITOS_KEY, JSON.stringify(novos)); } catch {}
  }

  return (
    <div className="space-y-2">
      {/* Barra compacta sempre visível */}
      <form
        onSubmit={(e) => { e.preventDefault(); aplicar(); }}
        className="flex gap-2 flex-wrap items-center"
      >
        <BuscaComSugestao
          valor={v.q}
          onChange={(q) => setV({ ...v, q })}
          onSelect={(id) => start(() => router.push(`/clientes/${id}`))}
        />

        <MultiSelect
          label="Status"
          opcoes={STATUS_OPCOES}
          selecionados={v.status}
          onChange={(arr) => setV({ ...v, status: arr })}
        />
        <MultiSelect
          label="Classificação"
          opcoes={CLASSIF_OPCOES}
          selecionados={v.classificacao}
          onChange={(arr) => setV({ ...v, classificacao: arr })}
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAberto((a) => !a)}
          aria-expanded={aberto}
        >
          {aberto ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Mais filtros
        </Button>

        <Button type="submit" disabled={pending}>
          {pending ? "Aplicando…" : "Aplicar"}
        </Button>
        {algumFiltro && (
          <Button type="button" variant="ghost" onClick={limpar} disabled={pending}>
            <X className="h-4 w-4" /> Limpar tudo
          </Button>
        )}
      </form>

      {/* Pílulas dos filtros ativos */}
      {algumFiltro && (
        <div className="flex gap-1.5 flex-wrap text-xs">
          {v.q && <Pilula label={`busca: "${v.q}"`} onRemove={() => { setV({ ...v, q: "" }); }} />}
          {v.status.map((s) => <Pilula key={`s-${s}`} label={`status: ${s}`} onRemove={() => toggleArr("status", s)} />)}
          {v.classificacao.map((c) => <Pilula key={`c-${c}`} label={`classif: ${c}`} onRemove={() => toggleArr("classificacao", c)} />)}
          {v.tributacao && <Pilula label={`tributação: ${v.tributacao}`} onRemove={() => setV({ ...v, tributacao: "" })} />}
          {v.prefeitura && <Pilula label={`município: ${v.prefeitura}`} onRemove={() => setV({ ...v, prefeitura: "" })} />}
          {v.segmento && <Pilula label={`segmento: ${v.segmento}`} onRemove={() => setV({ ...v, segmento: "" })} />}
          {v.responsavel && <Pilula label={`responsável: ${v.responsavel}`} onRemove={() => setV({ ...v, responsavel: "" })} />}
          {v.inadimplencia !== "todos" && <Pilula label={`inadimplência: ${rotuloInadimp(v.inadimplencia)}`} onRemove={() => setV({ ...v, inadimplencia: "todos" })} />}
          {v.sedeVirtual !== "todos" && <Pilula label={`sede virtual: ${v.sedeVirtual}`} onRemove={() => setV({ ...v, sedeVirtual: "todos" })} />}
          {v.avaliacaoGoogle !== "todos" && <Pilula label={`avaliou Google: ${v.avaliacaoGoogle}`} onRemove={() => setV({ ...v, avaliacaoGoogle: "todos" })} />}
          {v.folha !== "todos" && <Pilula label={`tem folha: ${v.folha}`} onRemove={() => setV({ ...v, folha: "todos" })} />}
        </div>
      )}

      {/* Painel expandido */}
      {aberto && (
        <div className="rounded-md border bg-muted/20 p-4 space-y-4">
          {/* Linha 1 — autocomplete textual */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <CampoAutocomplete label="Tributação" valor={v.tributacao} opcoes={opcoes.tributacoes}
              onChange={(x) => setV({ ...v, tributacao: x })} placeholder="ex: Simples" />
            <CampoAutocomplete label="Município" valor={v.prefeitura} opcoes={opcoes.prefeituras}
              onChange={(x) => setV({ ...v, prefeitura: x })} placeholder="ex: Porto Alegre/RS" />
            <CampoAutocomplete label="Segmento / categoria" valor={v.segmento} opcoes={opcoes.segmentos}
              onChange={(x) => setV({ ...v, segmento: x })} placeholder="ex: Psicologia" />
            <CampoAutocomplete label="Responsável" valor={v.responsavel} opcoes={opcoes.responsaveis}
              onChange={(x) => setV({ ...v, responsavel: x })} placeholder="ex: Camila" />
          </div>

          {/* Linha 2 — booleanos + ordenação */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <CampoSelect label="Inadimplência" valor={v.inadimplencia}
              opcoes={[["todos", "Todos"], ["0", "Sem cobrança em atraso"], ["1+", "Pelo menos 1"], ["3+", "3 ou mais (alerta)"]]}
              onChange={(x) => setV({ ...v, inadimplencia: x })} />
            <CampoSelect label="Sede virtual" valor={v.sedeVirtual}
              opcoes={[["todos", "Todos"], ["sim", "Tem"], ["nao", "Não tem"]]}
              onChange={(x) => setV({ ...v, sedeVirtual: x })} />
            <CampoSelect label="Avaliou no Google" valor={v.avaliacaoGoogle}
              opcoes={[["todos", "Todos"], ["sim", "Sim"], ["nao", "Não"]]}
              onChange={(x) => setV({ ...v, avaliacaoGoogle: x })} />
            <CampoSelect label="Tem folha" valor={v.folha}
              opcoes={[["todos", "Todos"], ["sim", "Sim"], ["nao", "Não"]]}
              onChange={(x) => setV({ ...v, folha: x })} />
            <CampoSelect label="Ordenar por" valor={v.ordenar}
              opcoes={[["razao", "Razão social"], ["codigo", "Código"], ["inicio_desc", "Mais recentes"], ["inicio_asc", "Mais antigos"]]}
              onChange={(x) => setV({ ...v, ordenar: x })} />
          </div>

          {/* Favoritos */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Filtros favoritos
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={salvarFavorito}
                disabled={!algumFiltro}
              >
                <Star className="h-3.5 w-3.5" />
                Salvar atual como favorito
              </Button>
            </div>
            {favoritos.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Nenhum favorito salvo. Configure um filtro acima e salve pra reusar.
              </p>
            ) : (
              <div className="flex gap-1.5 flex-wrap">
                {favoritos.map((f) => (
                  <button
                    key={f.nome}
                    type="button"
                    onClick={() => carregarFavorito(f.qs)}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border bg-white hover:bg-muted transition"
                  >
                    <Bookmark className="h-3 w-3 text-cestacorp-blue" />
                    <span>{f.nome}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={`Remover favorito ${f.nome}`}
                      onClick={(e) => { e.stopPropagation(); removerFavorito(f.nome); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          removerFavorito(f.nome);
                        }
                      }}
                      className="cursor-pointer text-muted-foreground hover:text-red-600"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Subcomponentes
// ───────────────────────────────────────────────────────────────────────

function rotuloInadimp(v: string): string {
  if (v === "0") return "em dia";
  if (v === "1+") return "1 ou mais";
  if (v === "3+") return "3+ (alerta)";
  return v;
}

function Pilula({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cestacorp-blue/10 text-cestacorp-blue text-[11px] font-medium">
      {label}
      <button type="button" onClick={onRemove} className="hover:bg-cestacorp-blue/20 rounded-full p-0.5" aria-label={`Remover filtro ${label}`}>
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

function MultiSelect({
  label, opcoes, selecionados, onChange,
}: {
  label: string;
  opcoes: string[];
  selecionados: string[];
  onChange: (s: string[]) => void;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="h-10 inline-flex items-center gap-1.5 rounded-md border bg-background px-3 text-sm hover:bg-muted/50"
        aria-haspopup="listbox"
        aria-expanded={aberto}
      >
        {label}
        {selecionados.length > 0 && (
          <span className="bg-cestacorp-blue text-white text-[10px] rounded-full px-1.5 py-0.5 font-semibold">
            {selecionados.length}
          </span>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <div className="absolute z-20 mt-1 bg-white border rounded-md shadow-lg p-1 min-w-[180px]" role="listbox">
            {opcoes.map((o) => (
              <label key={o} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={selecionados.includes(o)}
                  onChange={() => onChange(selecionados.includes(o) ? selecionados.filter((x) => x !== o) : [...selecionados, o])}
                  className="rounded"
                />
                {o}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CampoAutocomplete({
  label, valor, opcoes, onChange, placeholder,
}: {
  label: string; valor: string; opcoes: string[]; onChange: (v: string) => void; placeholder?: string;
}) {
  const id = "autocomp-" + label.replace(/\s+/g, "-").toLowerCase();
  const listId = id + "-list";
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        id={id}
        list={listId}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <datalist id={listId}>
        {opcoes.map((o) => <option key={o} value={o} />)}
      </datalist>
    </div>
  );
}

function CampoSelect({
  label, valor, opcoes, onChange,
}: {
  label: string; valor: string; opcoes: Array<[string, string]>; onChange: (v: string) => void;
}) {
  const id = "select-" + label.replace(/\s+/g, "-").toLowerCase();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
      <select
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {opcoes.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </div>
  );
}

interface Sugestao {
  id: string;
  codigo: number | null;
  razaoSocial: string;
  cpfCnpj: string;
}

/**
 * Busca com autocompletar (#94). Mostra sugestões "#codigo — razão social"
 * com debounce de 250ms via /api/admin/buscar-vinculo. Click leva direto à
 * ficha — não filtra a tabela (que continua disponível com Enter normal).
 */
function BuscaComSugestao({
  valor, onChange, onSelect,
}: {
  valor: string;
  onChange: (v: string) => void;
  onSelect: (id: string) => void;
}) {
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [hover, setHover] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!valor || valor.length < 2) { setSugestoes([]); return; }
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/buscar-vinculo?q=${encodeURIComponent(valor)}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        setSugestoes((j.clientes ?? []).slice(0, 8));
        setHover(0);
      } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(timer);
  }, [valor]);

  useEffect(() => {
    function fora(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  function lidarTeclas(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!aberto || sugestoes.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHover((h) => Math.min(h + 1, sugestoes.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHover((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter" && sugestoes[hover]) {
      e.preventDefault();
      onSelect(sugestoes[hover].id);
      setAberto(false);
    } else if (e.key === "Escape") {
      setAberto(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative flex-1 min-w-[240px] max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={valor}
        onChange={(e) => { onChange(e.target.value); setAberto(true); }}
        onFocus={() => setAberto(true)}
        onKeyDown={lidarTeclas}
        placeholder="Buscar por código, razão, CNPJ… ou seta+Enter pra abrir cliente"
        className="pl-10"
        autoComplete="off"
      />
      {aberto && sugestoes.length > 0 && (
        <ul className="absolute z-30 top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg max-h-72 overflow-y-auto">
          {sugestoes.map((s, i) => (
            <li
              key={s.id}
              onMouseEnter={() => setHover(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(s.id);
                setAberto(false);
              }}
              className={`px-3 py-2 cursor-pointer text-sm flex items-center gap-2 ${i === hover ? "bg-muted" : ""}`}
            >
              {s.codigo != null && (
                <span className="font-mono text-xs text-cestacorp-blue shrink-0">#{s.codigo}</span>
              )}
              <span className="flex-1 truncate">{s.razaoSocial}</span>
              <span className="text-[10px] text-muted-foreground font-mono shrink-0">{s.cpfCnpj}</span>
              {i === hover && <CornerDownLeft className="h-3 w-3 text-muted-foreground" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
