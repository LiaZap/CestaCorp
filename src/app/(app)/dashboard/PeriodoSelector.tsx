"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";

const OPCOES = [
  { dias: 7, label: "7 dias" },
  { dias: 14, label: "14 dias" },
  { dias: 30, label: "30 dias" },
  { dias: 60, label: "60 dias" },
  { dias: 90, label: "90 dias" },
  { dias: 180, label: "6 meses" },
  { dias: 365, label: "1 ano" },
];

export function PeriodoSelector({ atual }: { atual: number }) {
  const router = useRouter();
  const sp = useSearchParams();

  function trocar(dias: number) {
    const params = new URLSearchParams(sp.toString());
    params.set("dias", String(dias));
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div className="inline-flex items-center gap-1 bg-white border rounded-lg p-1 shadow-sm">
      <Calendar className="h-3.5 w-3.5 text-muted-foreground ml-1.5 mr-0.5" />
      {OPCOES.map((o) => {
        const ativo = o.dias === atual;
        return (
          <button
            key={o.dias}
            onClick={() => trocar(o.dias)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
              ativo
                ? "bg-cestacorp-blue text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
