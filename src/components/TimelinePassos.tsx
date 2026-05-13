"use client";
import { cn } from "@/lib/utils";
import { MessageSquare, Mail, Smartphone, Clock } from "lucide-react";

type Passo = {
  id?: string;
  nome: string;
  offsetDias: number;
  canal: "WHATSAPP" | "EMAIL" | "SMS";
  horarioEnvio?: string;
  stats?: { enviado: number; erro: number; pendente: number; pulado: number };
};

const CANAL_ICON = { WHATSAPP: MessageSquare, EMAIL: Mail, SMS: Smartphone };

export function TimelinePassos({ passos }: { passos: Passo[] }) {
  if (passos.length === 0) return null;

  const ordenados = [...passos].sort((a, b) => a.offsetDias - b.offsetDias);
  const minOff = Math.min(...ordenados.map((p) => p.offsetDias), 0);
  const maxOff = Math.max(...ordenados.map((p) => p.offsetDias), 0);
  const range = Math.max(1, maxOff - minOff);

  function pctPos(offset: number) {
    return ((offset - minOff) / range) * 100;
  }

  return (
    <div className="relative py-10 px-4 md:px-8 overflow-x-auto">
      {/* Linha base */}
      <div className="relative h-1 bg-gradient-to-r from-blue-300 via-slate-300 to-red-300 rounded-full my-16">
        {/* Marca do vencimento (offset 0) */}
        {minOff <= 0 && maxOff >= 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 h-8 w-1 bg-slate-700 rounded-full z-10"
            style={{ left: `${pctPos(0)}%` }}
          >
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-bold text-slate-800 bg-white px-2 py-0.5 rounded-full border-2 border-slate-700">
              VENCIMENTO
            </div>
          </div>
        )}

        {/* Passos */}
        {ordenados.map((p, i) => {
          const Icon = CANAL_ICON[p.canal] ?? MessageSquare;
          const pos = pctPos(p.offsetDias);
          const acima = i % 2 === 0;
          const antes = p.offsetDias < 0;
          const depois = p.offsetDias > 0;
          return (
            <div
              key={p.id ?? i}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20"
              style={{ left: `${pos}%` }}
            >
              <div
                className={cn(
                  "h-6 w-6 rounded-full border-4 border-white shadow-md flex items-center justify-center",
                  antes ? "bg-blue-500" : depois ? "bg-red-500" : "bg-amber-500"
                )}
              >
                <Icon className="h-3 w-3 text-white" />
              </div>
              {/* Card do passo */}
              <div
                className={cn(
                  "absolute left-1/2 -translate-x-1/2 w-40 text-center",
                  acima ? "bottom-full mb-3" : "top-full mt-3"
                )}
              >
                <div
                  className={cn(
                    "rounded-md border bg-white px-2 py-1.5 shadow-sm",
                    antes && "border-blue-200",
                    depois && "border-red-200",
                    p.offsetDias === 0 && "border-amber-200"
                  )}
                >
                  <p className="text-[10px] font-mono font-bold" style={{ color: antes ? "#2563eb" : depois ? "#dc2626" : "#d97706" }}>
                    {p.offsetDias === 0 ? "0d" : p.offsetDias > 0 ? `+${p.offsetDias}d` : `${p.offsetDias}d`}
                    {p.horarioEnvio && <span className="text-muted-foreground font-normal"> · {p.horarioEnvio}</span>}
                  </p>
                  <p className="text-xs font-semibold truncate">{p.nome}</p>
                  {p.stats && (
                    <div className="flex justify-center gap-2 text-[10px] mt-1 pt-1 border-t">
                      <span className="text-emerald-600 font-medium">{p.stats.enviado}✓</span>
                      {p.stats.pendente > 0 && <span className="text-amber-600">{p.stats.pendente}⏱</span>}
                      {p.stats.erro > 0 && <span className="text-red-600">{p.stats.erro}✗</span>}
                    </div>
                  )}
                </div>
                {/* Conector visual */}
                <div
                  className={cn(
                    "absolute left-1/2 -translate-x-1/2 w-0.5 bg-slate-300",
                    acima ? "top-full h-3" : "bottom-full h-3"
                  )}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex justify-center gap-4 mt-12 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> antes</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> no dia</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> atraso</span>
      </div>
    </div>
  );
}
