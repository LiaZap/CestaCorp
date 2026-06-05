"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * Botão de copiar pro clipboard com feedback visual inline + toast (#81).
 * O botão muda pra "Copiado!" por 2s e dispara um toast via sonner (montado
 * no app/(app)/layout.tsx). Funciona como fallback em navegadores sem
 * navigator.clipboard.
 *
 * Uso típico (PIX/linha digitável):
 *   <CopyButton value={cobranca.pixCopiaCola} label="Copiar PIX" />
 */
export function CopyButton({
  value,
  label = "Copiar",
  copiedLabel = "Copiado!",
  size = "sm",
  variant = "outline",
  className,
}: {
  value: string | null | undefined;
  label?: string;
  copiedLabel?: string;
  size?: "sm" | "md";
  variant?: "outline" | "ghost" | "solid";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function copy() {
    if (!value) return;
    setErro(null);
    // navigator.clipboard pode não existir em contextos não-https / iframes antigos.
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback: seleciona via textarea oculto. Sem clipboard API o execCommand
        // ainda funciona na maior parte dos navegadores corporativos antigos.
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(`${copiedLabel}`);
    } catch (e: any) {
      setErro("Não consegui copiar — selecione o texto manualmente");
      setTimeout(() => setErro(null), 4000);
      toast.error("Falha ao copiar — selecione o texto manualmente");
    }
  }

  const sizeCls = size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm";
  const variantCls =
    variant === "solid"
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : variant === "ghost"
      ? "hover:bg-muted"
      : "border bg-background hover:bg-muted";

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={copy}
        disabled={!value}
        aria-live="polite"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md font-medium transition disabled:opacity-50 disabled:cursor-not-allowed",
          sizeCls,
          variantCls,
          copied && "border-emerald-300 bg-emerald-50 text-emerald-700",
          className,
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? copiedLabel : label}
      </button>
      {erro && <span className="text-[11px] text-destructive">{erro}</span>}
    </div>
  );
}
