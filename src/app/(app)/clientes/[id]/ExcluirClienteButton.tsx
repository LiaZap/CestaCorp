"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trash2, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  clienteId: string;
  razaoSocial: string;
}

export function ExcluirClienteButton({ clienteId, razaoSocial }: Props) {
  const router = useRouter();
  const [confirma, setConfirma] = useState(false);
  const [digitado, setDigitado] = useState("");
  const [excluindo, setExcluindo] = useState(false);

  const exigeDigitar = razaoSocial.slice(0, 8).toUpperCase();
  const podeExcluir = digitado.toUpperCase() === exigeDigitar;

  async function executar() {
    setExcluindo(true);
    try {
      const r = await fetch(`/api/clientes/${clienteId}`, { method: "DELETE" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        toast.error(j.error ?? "Falha ao excluir");
        return;
      }
      toast.success(`Cliente movido pra Lixeira (30 dias pra restaurar)`);
      router.push("/clientes");
      router.refresh();
    } catch (err: any) {
      toast.error(`Erro: ${err?.message ?? err}`);
    } finally {
      setExcluindo(false);
    }
  }

  if (!confirma) {
    return (
      <Button variant="outline" onClick={() => setConfirma(true)} aria-label="Excluir cliente">
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={() => { setConfirma(false); setDigitado(""); }}
    >
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex-row items-start justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-500 mt-1 shrink-0" />
            <div>
              <CardTitle>Excluir cliente?</CardTitle>
              <CardDescription>{razaoSocial}</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => { setConfirma(false); setDigitado(""); }} aria-label="Cancelar">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm bg-amber-50 border border-amber-200 rounded p-3 text-amber-900">
            <p className="font-medium">É uma exclusão temporária:</p>
            <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
              <li>Cliente vai pra <strong>Lixeira</strong> e fica oculto da listagem</li>
              <li>Em até <strong>30 dias</strong> dá pra restaurar em Configurações → Lixeira</li>
              <li>Depois de 30 dias é apagado pra valer (LGPD)</li>
              <li>Contratos, cobranças e formulários ficam preservados</li>
            </ul>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">
              Pra confirmar, digite <code className="text-cestacorp-blue bg-muted px-1.5 py-0.5 rounded">{exigeDigitar}</code>
            </label>
            <input
              value={digitado}
              onChange={(e) => setDigitado(e.target.value)}
              className="w-full h-10 rounded-md border bg-background px-3 text-sm uppercase font-mono"
              placeholder={exigeDigitar}
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setConfirma(false); setDigitado(""); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={executar}
              disabled={!podeExcluir || excluindo}
            >
              <Trash2 className="h-4 w-4" /> {excluindo ? "Excluindo…" : "Mover pra Lixeira"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
