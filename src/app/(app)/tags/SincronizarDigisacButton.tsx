"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function SincronizarDigisacButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function sincronizar() {
    setLoading(true);
    try {
      const r = await fetch("/api/tags/sincronizar", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        toast.error(`Erro na sincronização: ${j.error ?? "falha desconhecida"}`);
        return;
      }
      const modoLabel: Record<string, string> = {
        real: "API real",
        demo: "modo demo (sem DIGISAC_TOKEN)",
        "api-indisponivel": "API indisponível — usou demo",
        "vazio-fallback": "API retornou vazio — usou demo",
      };
      let msg = `${j.novas} nova(s), ${j.atualizadas} atualizada(s)`;
      if (j.modo !== "real") msg += ` · ${modoLabel[j.modo] ?? j.modo}`;
      if (j.erros?.length) msg += ` · ${j.erros.length} erro(s)`;
      if (j.erros?.length) toast.warning(msg);
      else toast.success(msg);
      router.refresh();
    } catch (err: any) {
      toast.error(`Falha de rede: ${err?.message ?? err}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={sincronizar} disabled={loading} aria-label="Sincronizar tags com Digisac">
      <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Sincronizando…" : "Sincronizar Digisac"}
    </Button>
  );
}
