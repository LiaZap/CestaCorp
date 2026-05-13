"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Users, FileText, MessageSquareWarning, Calendar, TrendingUp,
  ClipboardList, Tag as TagIcon, BarChart3, Settings as SettingsIcon,
  Beaker, Megaphone, LayoutDashboard, Plus, Upload, Play, Bell,
  ArrowRight, User, Command,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";

type ClienteMini = { id: string; razaoSocial: string; nomeFantasia: string | null; cpfCnpj: string };

type Ação = {
  id: string;
  label: string;
  href: string;
  icon: any;
  group: "Navegar" | "Régua" | "Ações" | "Criar";
  shortcut?: string;
};

const ACOES: Ação[] = [
  { id: "dashboard", label: "Ir para Dashboard", href: "/dashboard", icon: LayoutDashboard, group: "Navegar" },
  { id: "clientes", label: "Ir para Clientes", href: "/clientes", icon: Users, group: "Navegar" },
  { id: "contratos", label: "Ir para Contratos", href: "/contratos", icon: FileText, group: "Navegar" },
  { id: "regua", label: "Ir para Régua de Cobrança", href: "/regua-cobranca", icon: MessageSquareWarning, group: "Navegar" },
  { id: "agenda", label: "Ir para Agenda", href: "/agenda", icon: Calendar, group: "Navegar" },
  { id: "reajustes", label: "Ir para Reajustes", href: "/reajustes", icon: TrendingUp, group: "Navegar" },
  { id: "formularios", label: "Ir para Formulários", href: "/formularios", icon: ClipboardList, group: "Navegar" },
  { id: "tags", label: "Ir para Tags", href: "/tags", icon: TagIcon, group: "Navegar" },
  { id: "relatorios", label: "Ir para Relatórios", href: "/relatorios", icon: BarChart3, group: "Navegar" },
  { id: "notificacoes", label: "Ir para Notificações", href: "/notificacoes", icon: Bell, group: "Navegar" },
  { id: "configuracoes", label: "Configurações do sistema", href: "/configuracoes", icon: SettingsIcon, group: "Navegar" },

  { id: "simular", label: "Simular envio da régua", href: "/regua-cobranca/simular", icon: Beaker, group: "Régua" },
  { id: "lote", label: "Envio em lote de cobrança", href: "/regua-cobranca/lote", icon: Megaphone, group: "Régua" },
  { id: "regua-nova", label: "Nova régua", href: "/regua-cobranca/nova", icon: Plus, group: "Régua" },

  { id: "cliente-novo", label: "Cadastrar novo cliente", href: "/clientes/novo", icon: Plus, group: "Criar" },
  { id: "importar-v106", label: "Importar planilha V106", href: "/clientes/importar", icon: Upload, group: "Criar" },
  { id: "obrigacao-nova", label: "Nova obrigação fiscal", href: "/agenda/nova", icon: Plus, group: "Criar" },
  { id: "contrato-lote", label: "Gerar contratos em lote", href: "/contratos/lote", icon: FileText, group: "Criar" },
  { id: "template-novo", label: "Novo template de contrato", href: "/contratos/templates/novo", icon: Plus, group: "Criar" },
  { id: "importar-google", label: "Importar Google Forms", href: "/formularios/importar-google", icon: Upload, group: "Criar" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [clientes, setClientes] = useState<ClienteMini[]>([]);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  // Atalho ⌘K / Ctrl+K
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Busca de clientes
  useEffect(() => {
    if (!open) return;
    if (!q.trim()) { setClientes([]); return; }
    const ctl = new AbortController();
    fetch(`/api/search/clientes?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
      .then((r) => r.ok ? r.json() : [])
      .then(setClientes)
      .catch(() => {});
    return () => ctl.abort();
  }, [q, open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
        if (listaRef.current) listaRef.current.scrollTop = 0;
      }, 50);
    }
    else { setQ(""); setIdx(0); }
  }, [open]);

  const acoesFiltradas = useMemo(() => {
    const lower = q.toLowerCase();
    if (!lower) return ACOES;
    return ACOES.filter((a) =>
      a.label.toLowerCase().includes(lower) ||
      a.group.toLowerCase().includes(lower)
    );
  }, [q]);

  // Lista unificada para navegação por teclado
  const itens = useMemo(() => {
    const lista: { type: "acao" | "cliente"; id: string; label: string; sublabel?: string; href: string; icon?: any; group: string }[] = [];
    for (const a of acoesFiltradas) {
      lista.push({ type: "acao", id: a.id, label: a.label, href: a.href, icon: a.icon, group: a.group });
    }
    for (const c of clientes) {
      lista.push({
        type: "cliente", id: c.id,
        label: c.nomeFantasia ?? c.razaoSocial,
        sublabel: `${c.razaoSocial} · ${c.cpfCnpj}`,
        href: `/clientes/${c.id}`,
        group: "Clientes",
      });
    }
    return lista;
  }, [acoesFiltradas, clientes]);

  // Reset idx quando lista muda
  useEffect(() => { setIdx(0); }, [q, clientes.length]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, itens.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter") {
      e.preventDefault();
      const alvo = itens[idx];
      if (alvo) { setOpen(false); router.push(alvo.href); }
    }
  }

  // Agrupar para exibição
  const grupos = useMemo(() => {
    const map = new Map<string, typeof itens>();
    for (const i of itens) {
      if (!map.has(i.group)) map.set(i.group, []);
      map.get(i.group)!.push(i);
    }
    return Array.from(map.entries());
  }, [itens]);

  let globalIdx = -1;

  return (
    <>
      {/* Botão do topbar */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex w-full items-center gap-2 rounded-md border bg-white/70 backdrop-blur px-3 py-2 text-sm text-muted-foreground hover:border-cestacorp-blue/40 hover:text-cestacorp-blue transition"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left truncate">Buscar cliente, página ou ação…</span>
        <kbd className="ml-2 inline-flex h-5 items-center gap-0.5 rounded border bg-slate-50 px-1.5 font-mono text-[10px] text-slate-500 shrink-0">
          <Command className="h-3 w-3" />K
        </kbd>
      </button>

      {/* Modal — centralizado considerando a sidebar (lg: 256px) */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center p-4 pt-[12vh] lg:pl-[272px]"
          onClick={() => setOpen(false)}
          onScroll={(e) => e.preventDefault()}
        >
          <div
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border animate-[wizardIn_180ms_ease]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 border-b">
              <Search className="h-5 w-5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKey}
                placeholder="Buscar cliente, página ou ação…"
                className="flex-1 h-14 bg-transparent outline-none text-base"
              />
              <kbd className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">ESC</kbd>
            </div>

            <div ref={listaRef} className="max-h-[60vh] overflow-y-auto">
              {grupos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nada encontrado para <b>"{q}"</b>
                </p>
              ) : (
                grupos.map(([grupo, items]) => (
                  <div key={grupo} className="py-2">
                    <p className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {grupo}
                    </p>
                    {items.map((it) => {
                      globalIdx++;
                      const selected = globalIdx === idx;
                      const Icon = it.icon;
                      return (
                        <button
                          key={it.type + "-" + it.id}
                          onClick={() => { setOpen(false); router.push(it.href); }}
                          onMouseEnter={() => setIdx(globalIdx)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm",
                            selected ? "bg-cestacorp-blue/10 text-cestacorp-blue" : "hover:bg-slate-50"
                          )}
                        >
                          {it.type === "cliente" ? (
                            <Avatar name={it.label} size="sm" />
                          ) : Icon ? (
                            <div className={cn(
                              "h-8 w-8 rounded-md flex items-center justify-center",
                              selected ? "bg-cestacorp-blue text-white" : "bg-slate-100 text-slate-600"
                            )}>
                              <Icon className="h-4 w-4" />
                            </div>
                          ) : null}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{it.label}</p>
                            {it.sublabel && <p className="text-xs text-muted-foreground truncate">{it.sublabel}</p>}
                          </div>
                          {selected && <ArrowRight className="h-4 w-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-2 px-4 py-2 border-t bg-slate-50/50 text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1"><kbd className="border rounded px-1">↑↓</kbd> navegar</span>
                <span className="inline-flex items-center gap-1"><kbd className="border rounded px-1">↵</kbd> abrir</span>
              </div>
              <span className="hidden sm:inline">
                {itens.length} resultado{itens.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
