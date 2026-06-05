"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/lib/toast";

export type LixeiraModelo = "cliente" | "contrato" | "cobranca" | "evento";

export function LixeiraActions({ modelo, id }: { modelo: LixeiraModelo; id: string }) {
  const router = useRouter();
  const [confirmPurge, setConfirmPurge] = React.useState(false);

  async function restaurar() {
    try {
      const res = await fetch(`/api/lixeira/${modelo}/${id}/restaurar`, { method: "POST" });
      if (!res.ok) throw new Error("Falha ao restaurar");
      toast.success("Registro restaurado");
      router.refresh();
    } catch (err: any) {
      toast.error("Erro", err?.message ?? "Tente novamente");
    }
  }

  async function purgar() {
    try {
      const res = await fetch(`/api/lixeira/${modelo}/${id}/purgar`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao apagar definitivamente");
      toast.success("Registro apagado definitivamente");
      router.refresh();
    } catch (err: any) {
      toast.error("Erro", err?.message ?? "Tente novamente");
    }
  }

  return (
    <div className="flex gap-2 justify-end">
      <Button size="sm" variant="outline" onClick={restaurar} aria-label="Restaurar registro">
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        Restaurar
      </Button>
      <Button size="sm" variant="destructive" onClick={() => setConfirmPurge(true)} aria-label="Apagar definitivamente">
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        Apagar
      </Button>
      <ConfirmDialog
        open={confirmPurge}
        onOpenChange={setConfirmPurge}
        title="Apagar definitivamente?"
        description="Esta ação é irreversível. O registro será removido do banco."
        confirmLabel="Apagar definitivo"
        variant="destructive"
        onConfirm={purgar}
      />
    </div>
  );
}
