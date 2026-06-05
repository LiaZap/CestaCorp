"use client";

/**
 * Filtros multi-coluna para /clientes (call 18/05 — issue #4).
 * Mantém estado na URL (compartilhável + back/forward funciona).
 * Permite salvar/restaurar favoritos via localStorage.
 * Exporta CSV do filtro atual.
 */
import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Star, StarOff, FileDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface OpcoesFiltro {
  tributacoes: string[];
  classificacoes: string[];
  status: string[];
  seguimentos: string[];
  categorias: string[];
  prefeituras: string[];
  folhas: string[];
  responsaveis: { id: string; name: string }[];
  tags: { id: string; nome: string }[];
}

const FAVORITOS_KEY = "cestacorp:clientes:filtros-favoritos";

interface FavoritoSalvo {
  nome: string;
  qs: string;
}

export function FiltrosClientes({ opcoes }: { opcoes: OpcoesFiltro }) {
  const router = useRouter();
  const params = useSearchParams();

  // Estado local copiado da URL pra permitir "rascunho" antes de aplicar.
  const [q, setQ] = useState(() => params?.get("q") ?? "");
  const [tributacao, setTributacao] = useState(() => params?.get("tributacao") ?? "");
  const [status, setStatus] = useState(() => params?.get("status") ?? "");
  const [classificacao, setClassificacao] = useState(() => params?.get("classificacao") ?? "");
  const [seguimento, setSeguimento] = useState(() => params?.get("seguimento") ?? "");
  const [categoria, setCategoria] = useState(() => params?.get("categoria") ?? "");
  const [prefeitura, setPrefeitura] = useState(() => params?.get("prefeitura") ?? "");
  const [folha, setFolha] = useState(() => params?.get("folha") ?? "");
  const [sedeVirtual, setSedeVirtual] = useState(() => params?.get("sedeVirtual") ?? "");
  const [avaliacaoGoogle, setAvaliacaoGoogle] = useState(() => params?.get("avaliacaoGoogle") ?? "");
  const [respFiscal, setRespFiscal] = useState(() => params?.get("respFiscal") ?? "");
  const [respFolha, setRespFolha] = useState(() => params?.get("respFolha") ?? "");
  const [respContabil, setRespContabil] = useState(() => params?.get("respContabil") ?? "");
  const [tag, setTag] = useState(() => params?.get("tag") ?? "");

  // Sync se URL mudar de fora (back/forward).
  useEffect(() => {
    setQ(params?.get("q") ?? "");
    setTributacao(params?.get("tributacao") ?? "");
    setStatus(params?.get("status") ?? "");
    setClassificacao(params?.get("classificacao") ?? "");
    setSeguimento(params?.get("seguimento") ?? "");
    setCategoria(params?.get("categoria") ?? "");
    setPrefeitura(params?.get("prefeitura") ?? "");
    setFolha(params?.get("folha") ?? "");
    setSedeVirtual(params?.get("sedeVirtual") ?? "");
    setAvaliacaoGoogle(params?.get("avaliacaoGoogle") ?? "");
    setRespFiscal(params?.get("respFiscal") ?? "");
    setRespFolha(params?.get("respFolha") ?? "");
    setRespContabil(params?.get("respContabil") ?? "");
    setTag(params?.get("tag") ?? "");
  }, [params]);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (tributacao) sp.set("tributacao", tributacao);
    if (status) sp.set("status", status);
    if (classificacao) sp.set("classificacao", classificacao);
    if (seguimento) sp.set("seguimento", seguimento);
    if (categoria) sp.set("categoria", categoria);
    if (prefeitura) sp.set("prefeitura", prefeitura);
    if (folha) sp.set("folha", folha);
    if (sedeVirtual) sp.set("sedeVirtual", sedeVirtual);
    if (avaliacaoGoogle) sp.set("avaliacaoGoogle", avaliacaoGoogle);
    if (respFiscal) sp.set("respFiscal", respFiscal);
    if (respFolha) sp.set("respFolha", respFolha);
    if (respContabil) sp.set("respContabil", respContabil);
    if (tag) sp.set("tag", tag);
    return sp.toString();
  }, [q, tributacao, status, classificacao, seguimento, categoria, prefeitura, folha, sedeVirtual, avaliacaoGoogle, respFiscal, respFolha, respContabil, tag]);

  function aplicar() {
    router.push("/clientes" + (queryString ? `?${queryString}` : ""));
  }

  function limpar() {
    router.push("/clientes");
  }

  // ===== Favoritos (localStorage) =====
  const [favoritos, setFavoritos] = useState<FavoritoSalvo[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITOS_KEY);
      if (raw) setFavoritos(JSON.parse(raw));
    } catch {
      // localStorage indisponível (SSR / bloqueado)
    }
  }, []);

  function salvarFavorito() {
    const nome = prompt("Nome para este filtro favorito:");
    if (!nome?.trim()) return;
    const novo: FavoritoSalvo = { nome: nome.trim(), qs: queryString };
    const lista = [...favoritos.filter((f) => f.nome !== novo.nome), novo];
    setFavoritos(lista);
    try { localStorage.setItem(FAVORITOS_KEY, JSON.stringify(lista)); } catch {}
  }
  function removerFavorito(nome: string) {
    const lista = favoritos.filter((f) => f.nome !== nome);
    setFavoritos(lista);
    try { localStorage.setItem(FAVORITOS_KEY, JSON.stringify(lista)); } catch {}
  }
  function aplicarFavorito(qs: string) {
    router.push("/clientes" + (qs ? `?${qs}` : ""));
  }

  const algumFiltro = !!queryString;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-2">
        <div className="relative md:col-span-2 xl:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por razão social, fantasia ou CNPJ…"
            className="pl-10"
            onKeyDown={(e) => { if (e.key === "Enter") aplicar(); }}
          />
        </div>

        <SelectField label="Status" value={status} onChange={setStatus} options={opcoes.status} />
        <SelectField label="Tributação" value={tributacao} onChange={setTributacao} options={opcoes.tributacoes} />
        <SelectField label="Classificação" value={classificacao} onChange={setClassificacao} options={opcoes.classificacoes} />
        <ComboboxField label="Seguimento" value={seguimento} onChange={setSeguimento} options={opcoes.seguimentos} />
        <ComboboxField label="Categoria" value={categoria} onChange={setCategoria} options={opcoes.categorias} />
        <ComboboxField label="Prefeitura" value={prefeitura} onChange={setPrefeitura} options={opcoes.prefeituras} />
        <SelectField label="Folha" value={folha} onChange={setFolha} options={opcoes.folhas} />
        <SelectField
          label="Sede virtual"
          value={sedeVirtual}
          onChange={setSedeVirtual}
          options={["sim", "nao"]}
          labelMap={{ sim: "Sim", nao: "Não" }}
        />
        <SelectField
          label="Avaliação Google"
          value={avaliacaoGoogle}
          onChange={setAvaliacaoGoogle}
          options={["sim", "nao"]}
          labelMap={{ sim: "Avaliou", nao: "Não avaliou" }}
        />
        <SelectField
          label="Resp. fiscal"
          value={respFiscal}
          onChange={setRespFiscal}
          options={opcoes.responsaveis.map((r) => r.id)}
          labelMap={Object.fromEntries(opcoes.responsaveis.map((r) => [r.id, r.name]))}
        />
        <SelectField
          label="Resp. folha"
          value={respFolha}
          onChange={setRespFolha}
          options={opcoes.responsaveis.map((r) => r.id)}
          labelMap={Object.fromEntries(opcoes.responsaveis.map((r) => [r.id, r.name]))}
        />
        <SelectField
          label="Resp. contábil"
          value={respContabil}
          onChange={setRespContabil}
          options={opcoes.responsaveis.map((r) => r.id)}
          labelMap={Object.fromEntries(opcoes.responsaveis.map((r) => [r.id, r.name]))}
        />
        <SelectField
          label="Tag"
          value={tag}
          onChange={setTag}
          options={opcoes.tags.map((t) => t.id)}
          labelMap={Object.fromEntries(opcoes.tags.map((t) => [t.id, t.nome]))}
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={aplicar} variant="secondary">Aplicar filtros</Button>
        {algumFiltro && (
          <Button onClick={limpar} variant="ghost">
            <X className="h-4 w-4" /> Limpar
          </Button>
        )}
        <Button onClick={salvarFavorito} variant="outline" disabled={!algumFiltro}>
          <Star className="h-4 w-4" /> Salvar favorito
        </Button>
        <Button asChild variant="outline">
          <a href={`/api/clientes/export${queryString ? `?${queryString}` : ""}`}>
            <FileDown className="h-4 w-4" /> Exportar CSV
          </a>
        </Button>

        {favoritos.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-muted-foreground ml-2">Favoritos:</span>
            {favoritos.map((f) => (
              <span key={f.nome} className="inline-flex items-center gap-1 rounded-md border bg-muted/30 pl-2 pr-1 py-1 text-xs">
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => aplicarFavorito(f.qs)}
                  title="Aplicar este filtro favorito"
                >
                  {f.nome}
                </button>
                <button
                  type="button"
                  aria-label={`Remover favorito ${f.nome}`}
                  className="opacity-60 hover:opacity-100"
                  onClick={() => removerFavorito(f.nome)}
                >
                  <StarOff className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Subcomponents =====

function SelectField({
  label, value, onChange, options, labelMap,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labelMap?: Record<string, string>;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-md border bg-background px-3 text-sm"
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o} value={o}>{labelMap?.[o] ?? o}</option>
        ))}
      </select>
    </label>
  );
}

/**
 * Combobox simples: input com autocomplete via <datalist>.
 * Permite escolher um valor da lista OU digitar livre (cobre o caso de
 * seguimento/categoria com cardinalidade alta).
 */
function ComboboxField({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const listId = `combo-${label}`;
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase text-muted-foreground">{label}</span>
      <input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Todos"
        className="h-10 rounded-md border bg-background px-3 text-sm"
      />
      <datalist id={listId}>
        {options.map((o) => <option key={o} value={o} />)}
      </datalist>
    </label>
  );
}
