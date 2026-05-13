"use client";
import { cn } from "@/lib/utils";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function HeatmapHorarios({ matriz, max }: { matriz: number[][]; max: number }) {
  const intensidade = (v: number) => {
    if (!v || max === 0) return 0;
    return v / max;
  };

  const cor = (v: number) => {
    const i = intensidade(v);
    if (i === 0) return "#f1f5f9"; // slate-100
    // gradient de lime/verde → azul Cestacorp conforme intensidade
    const colors = [
      "#ecfccb", // lime-100
      "#d9f99d", // lime-200
      "#bef264", // lime-300
      "#a3e635", // lime-400
      "#84cc16", // lime-500
      "#65a30d", // lime-600
      "#4d7c0f", // lime-700
    ];
    const idx = Math.min(colors.length - 1, Math.floor(i * colors.length));
    return colors[idx];
  };

  // Ticks de hora mostrados (0, 6, 12, 18)
  const ticks = [0, 6, 12, 18, 23];

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Linha de horas no topo */}
        <div className="flex items-end pl-10 mb-1">
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="flex-1 text-[9px] text-muted-foreground text-center">
              {ticks.includes(h) ? `${h}h` : ""}
            </div>
          ))}
        </div>

        {DIAS.map((dia, d) => (
          <div key={dia} className="flex items-center">
            <span className="w-10 text-[11px] font-medium text-muted-foreground">{dia}</span>
            <div className="flex-1 flex gap-[2px]">
              {matriz[d].map((v, h) => {
                const i = intensidade(v);
                return (
                  <div
                    key={h}
                    className="flex-1 aspect-square rounded-sm relative group"
                    style={{ background: cor(v), minWidth: 10 }}
                  >
                    {v > 0 && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">
                        {dia} {h}h — <b>{v}</b> envio{v !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Legenda */}
        <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-muted-foreground">
          <span>menos</span>
          {[0, 0.15, 0.35, 0.55, 0.75, 1].map((i, k) => (
            <span
              key={k}
              className="h-3 w-3 rounded-sm"
              style={{ background: cor(i * max) }}
            />
          ))}
          <span>mais envios</span>
        </div>
      </div>
    </div>
  );
}
