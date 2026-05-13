"use client";
import { useState, useRef, RefObject } from "react";
import { Search } from "lucide-react";

/**
 * Descrição human-readable de cada placeholder da régua/template.
 * Agrupado pra UX melhor.
 */
const GRUPOS: { nome: string; itens: { token: string; label: string; sample: string }[] }[] = [
  {
    nome: "Cliente",
    itens: [
      { token: "{cliente.razaoSocial}", label: "Razão social", sample: "TechNova LTDA" },
      { token: "{cliente.nomeFantasia}", label: "Nome fantasia", sample: "TechNova" },
      { token: "{cliente.cpfCnpj}", label: "CPF/CNPJ", sample: "12.345.678/0001-00" },
    ],
  },
  {
    nome: "Cobrança",
    itens: [
      { token: "{cobranca.descricao}", label: "Descrição", sample: "Honorário 04/2026" },
      { token: "{cobranca.valor|money}", label: "Valor bruto", sample: "R$ 1.850,00" },
      { token: "{cobranca.vencimento|date}", label: "Vencimento", sample: "25/04/2026" },
      { token: "{cobranca.linhaDigitavel}", label: "Linha digitável", sample: "23793…" },
      { token: "{cobranca.urlBoleto}", label: "Link do boleto", sample: "https://…" },
      { token: "{cobranca.pixCopiaCola}", label: "PIX copia-cola", sample: "00020126…" },
    ],
  },
  {
    nome: "Atualização (juros + multa)",
    itens: [
      { token: "{cobranca.valorAtualizado|money}", label: "Valor atualizado", sample: "R$ 1.928,50" },
      { token: "{cobranca.juros|money}", label: "Juros (R$)", sample: "R$ 18,50" },
      { token: "{cobranca.multa|money}", label: "Multa (R$)", sample: "R$ 37,00" },
      { token: "{cobranca.diasAtraso}", label: "Dias em atraso", sample: "3" },
    ],
  },
  {
    nome: "Data",
    itens: [
      { token: "{hoje|date}", label: "Data de hoje", sample: "24/04/2026" },
    ],
  },
];

export function PlaceholderPicker({
  textareaRef,
  value,
  onChange,
  compact = false,
}: {
  textareaRef: RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (novoValor: string) => void;
  compact?: boolean;
}) {
  const [filtro, setFiltro] = useState("");

  function inserir(token: string) {
    const el = textareaRef.current;
    if (!el) {
      onChange(value + token);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const antes = value.slice(0, start);
    const depois = value.slice(end);
    const novo = antes + token + depois;
    onChange(novo);

    // Reposiciona cursor depois do token inserido
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  const f = filtro.trim().toLowerCase();
  const grupos = GRUPOS.map((g) => ({
    ...g,
    itens: g.itens.filter(
      (i) =>
        !f ||
        i.token.toLowerCase().includes(f) ||
        i.label.toLowerCase().includes(f)
    ),
  })).filter((g) => g.itens.length > 0);

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {GRUPOS.flatMap((g) => g.itens).map((i) => (
          <button
            key={i.token}
            type="button"
            onClick={() => inserir(i.token)}
            title={`Insere: ${i.token}`}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white hover:border-cestacorp-blue hover:bg-blue-50 hover:text-cestacorp-blue px-2 py-1 text-[11px] font-medium transition"
          >
            <span className="opacity-60">+</span> {i.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-slate-50/50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Clique para inserir
        </p>
        <div className="relative">
          <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar…"
            className="h-7 w-36 rounded-md border bg-white pl-6 pr-2 text-xs focus:outline-none focus:ring-2 focus:ring-cestacorp-blue/30"
          />
        </div>
      </div>

      {grupos.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhum placeholder encontrado</p>
      ) : (
        grupos.map((g) => (
          <div key={g.nome}>
            <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">{g.nome}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.itens.map((i) => (
                <button
                  key={i.token}
                  type="button"
                  onClick={() => inserir(i.token)}
                  title={`${i.token} → ${i.sample}`}
                  className="group inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white hover:border-cestacorp-blue hover:bg-blue-50 px-2 py-1 text-xs transition"
                >
                  <span className="text-muted-foreground group-hover:text-cestacorp-blue font-bold">+</span>
                  <span className="font-medium">{i.label}</span>
                  <code className="text-[10px] text-muted-foreground group-hover:text-cestacorp-blue/70 hidden sm:inline">
                    {i.token.replace(/[{}]/g, "")}
                  </code>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
