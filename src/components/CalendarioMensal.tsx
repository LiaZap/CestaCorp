"use client";
import Link from "next/link";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

type Evento = {
  id: string;
  titulo: string;
  dataVencimento: string | Date;
  status: "PENDENTE" | "CONCLUIDO" | "ATRASADO" | "ISENTO" | "CANCELADO";
  cliente?: { razaoSocial: string } | null;
  obrigacao?: { tipo: string } | null;
};

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

const STATUS_STYLE: Record<string, string> = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-200",
  CONCLUIDO: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ATRASADO: "bg-red-100 text-red-800 border-red-200",
  ISENTO: "bg-slate-100 text-slate-700 border-slate-200",
  CANCELADO: "bg-slate-50 text-slate-500 border-slate-100 line-through",
};

export function CalendarioMensal({ ano, mes, eventos }: { ano: number; mes: number; eventos: Evento[] }) {
  const primeiroDia = new Date(ano, mes - 1, 1);
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const offsetInicial = primeiroDia.getDay();
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const porDia = useMemo(() => {
    const map = new Map<number, Evento[]>();
    for (const e of eventos) {
      const dt = new Date(e.dataVencimento);
      const dia = dt.getDate();
      if (!map.has(dia)) map.set(dia, []);
      map.get(dia)!.push(e);
    }
    return map;
  }, [eventos]);

  const celulas: Array<{ dia: number | null }> = [];
  for (let i = 0; i < offsetInicial; i++) celulas.push({ dia: null });
  for (let d = 1; d <= diasNoMes; d++) celulas.push({ dia: d });
  while (celulas.length % 7 !== 0) celulas.push({ dia: null });

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="grid grid-cols-7 bg-muted text-xs font-semibold text-muted-foreground">
        {SEMANA.map((s, i) => (
          <div key={i} className="p-2 text-center">{s}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {celulas.map((cel, i) => {
          const itens = cel.dia ? porDia.get(cel.dia) ?? [] : [];
          const dataCelula = cel.dia ? new Date(ano, mes - 1, cel.dia) : null;
          const isHoje = dataCelula?.getTime() === hoje.getTime();
          const isPassado = dataCelula && dataCelula.getTime() < hoje.getTime();

          return (
            <div
              key={i}
              className={cn(
                "min-h-24 border-t border-r p-1.5 text-xs flex flex-col gap-1",
                !cel.dia && "bg-muted/30",
                isHoje && "bg-primary/5 ring-2 ring-primary ring-inset",
                i % 7 === 6 && "border-r-0"
              )}
            >
              {cel.dia != null && (
                <>
                  <div className={cn(
                    "font-semibold self-start px-1.5 rounded",
                    isHoje && "bg-primary text-white",
                    isPassado && !isHoje && "text-muted-foreground"
                  )}>
                    {cel.dia}
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    {itens.slice(0, 3).map((e) => (
                      <Link
                        key={e.id}
                        href={`/agenda/${e.id}`}
                        className={cn(
                          "block border rounded px-1.5 py-0.5 truncate text-[10px] leading-tight",
                          STATUS_STYLE[e.status] ?? "bg-muted"
                        )}
                        title={`${e.titulo}${e.cliente ? " · " + e.cliente.razaoSocial : ""}`}
                      >
                        {e.obrigacao?.tipo && <span className="font-bold mr-1">{e.obrigacao.tipo}</span>}
                        {e.cliente?.razaoSocial ?? e.titulo}
                      </Link>
                    ))}
                    {itens.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{itens.length - 3} outro(s)</span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
