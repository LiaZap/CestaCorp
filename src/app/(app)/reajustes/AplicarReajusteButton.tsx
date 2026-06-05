"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";

/**
 * Botão "Aplicar reajuste" com confirmação inline.
 * Substitui o form POST cru — agora exige um confirm antes do submit
 * pra evitar aplicar reajuste no cliente errado por clique acidental.
 *
 * Usa window.confirm como bridge temporário até termos um ConfirmDialog
 * proprio compartilhado (provavelmente próximo PR).
 */
export function AplicarReajusteButton({
  clienteId,
  razaoSocial,
  percentual,
  valorAtual,
  valorProposto,
}: {
  clienteId: string;
  razaoSocial: string;
  percentual: number;
  valorAtual: number;
  valorProposto: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function aplicar() {
    const msg = [
      `Aplicar reajuste de ${percentual.toFixed(2)}% em ${razaoSocial}?`,
      "",
      `Valor atual: R$ ${valorAtual.toFixed(2)}`,
      `Valor proposto: R$ ${valorProposto.toFixed(2)}`,
      "",
      "Esta ação registra um ReajusteHistorico e não pode ser desfeita pelo aplicativo.",
    ].join("\n");
    if (!window.confirm(msg)) return;

    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("clienteId", clienteId);
      const r = await fetch("/api/reajustes/propostas", { method: "POST", body: fd });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert("Erro ao aplicar reajuste: " + (j.error ?? r.statusText));
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" type="button" onClick={aplicar} disabled={loading}>
      <TrendingUp className="h-3 w-3" />
      {loading ? "Aplicando…" : "Aplicar"}
    </Button>
  );
}
