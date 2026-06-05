"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageSquareWarning, FileDown, ChevronLeft, ChevronRight, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "@/lib/toast";
import { formatMoney, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

type CobrancaRow = {
  id: string;
  descricao: string | null;
  valor: number;
  vencimento: string;
  dataPagamento: string | null;
  status: string;
  cliente: { id: string; nome: string; classificacao: string | null };
};

type Props = {
  cobrancas: CobrancaRow[];
  pagina: number;
  totalPaginas: number;
  totalRegistros: number;
  baseQs: string;
};

export function CobrancasActions({ cobrancas, pagina, totalPaginas, totalRegistros, baseQs }: Props) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirmMarcarPago, setConfirmMarcarPago] = React.useState(false);
  const [confirmDisparar, setConfirmDisparar] = React.useState(false);

  function buildHref(p: number) {
    const params = new URLSearchParams(baseQs);
    if (p > 1) params.set("pagina", String(p));
    const qs = params.toString();
    return "/cobrancas" + (qs ? `?${qs}` : "");
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(cobrancas.map((c) => c.id)));
    } else {
      setSelected(new Set());
    }
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const allSelected = cobrancas.length > 0 && selected.size === cobrancas.length;
  const totalSelected = cobrancas
    .filter((c) => selected.has(c.id))
    .reduce((acc, c) => acc + c.valor, 0);

  async function marcarPagas() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      const res = await fetch("/api/cobrancas/marcar-pagas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Falha ao marcar como pago");
      toast.success(`${ids.length} cobrança(s) marcadas como pagas`);
      setSelected(new Set());
      router.refresh();
    } catch (err: any) {
      toast.error("Erro", err?.message ?? "Tente novamente");
    }
  }

  async function dispararRegua() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      const res = await fetch("/api/cobrancas/disparar-regua", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Falha ao disparar régua");
      toast.success(`Régua disparada para ${ids.length} cobrança(s)`);
      setSelected(new Set());
      router.refresh();
    } catch (err: any) {
      toast.error("Erro", err?.message ?? "Tente novamente");
    }
  }

  function exportarCsv() {
    const params = new URLSearchParams(baseQs);
    window.open(`/api/cobrancas/exportar?${params.toString()}`, "_blank");
  }

  return (
    <>
      {selected.size > 0 && (
        <div className="sticky top-16 z-10 -mx-2 px-2 py-2 bg-cestacorp-blue text-white rounded-md flex items-center justify-between gap-3 flex-wrap shadow-lg">
          <div className="text-sm">
            <span className="font-semibold">{selected.size}</span> selecionada(s) ·{" "}
            <span className="font-semibold">{formatMoney(totalSelected)}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setConfirmMarcarPago(true)}
              aria-label="Marcar selecionadas como pagas"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Marcar pagas
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setConfirmDisparar(true)}
              aria-label="Disparar régua para selecionadas"
            >
              <MessageSquareWarning className="h-4 w-4" aria-hidden="true" />
              Disparar régua
            </Button>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/15" onClick={() => setSelected(new Set())}>
              Limpar
            </Button>
          </div>
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between px-6 pt-5">
          <div className="text-sm text-muted-foreground">
            Página {pagina} de {totalPaginas} · {totalRegistros.toLocaleString("pt-BR")} no total
          </div>
          <Button variant="outline" size="sm" onClick={exportarCsv} aria-label="Exportar CSV">
            <FileDown className="h-4 w-4" aria-hidden="true" />
            Exportar
          </Button>
        </div>
        <CardContent className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3 w-8">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todas as cobranças desta página"
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                    className="h-4 w-4"
                  />
                </th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Descrição</th>
                <th className="py-2 pr-3">Classif.</th>
                <th className="py-2 pr-3">Vencimento</th>
                <th className="py-2 pr-3 text-right">Valor</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {cobrancas.map((c) => {
                const checked = selected.has(c.id);
                return (
                  <tr
                    key={c.id}
                    className={cn(
                      "border-b last:border-0 hover:bg-muted/50 cursor-pointer",
                      checked && "bg-blue-50/60",
                    )}
                    onClick={(e) => {
                      // Não navegar se clicou no checkbox
                      const tag = (e.target as HTMLElement).tagName;
                      if (tag === "INPUT" || tag === "LABEL") return;
                      router.push(`/cobrancas/${c.id}`);
                    }}
                  >
                    <td className="py-2 pr-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Selecionar cobrança de ${c.cliente.nome}`}
                        checked={checked}
                        onChange={(e) => toggleOne(c.id, e.target.checked)}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <span className="font-medium">{c.cliente.nome}</span>
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">
                      {c.descricao ?? "Honorário"}
                    </td>
                    <td className="py-2 pr-3 text-xs">{c.cliente.classificacao ?? "—"}</td>
                    <td className="py-2 pr-3">{formatDate(c.vencimento)}</td>
                    <td className="py-2 pr-3 text-right font-medium">{formatMoney(c.valor)}</td>
                    <td className="py-2 pr-3">
                      <span className={"status-badge " + statusToClass(c.status)}>{c.status}</span>
                    </td>
                  </tr>
                );
              })}
              {cobrancas.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-40" aria-hidden="true" />
                    Nenhuma cobrança encontrada com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
        {totalPaginas > 1 && (
          <div className="border-t px-6 py-3 flex items-center justify-between">
            <Button variant="ghost" size="sm" asChild disabled={pagina <= 1}>
              <Link href={buildHref(Math.max(1, pagina - 1))} aria-disabled={pagina <= 1}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Anterior
              </Link>
            </Button>
            <span className="text-sm text-muted-foreground">
              {pagina} / {totalPaginas}
            </span>
            <Button variant="ghost" size="sm" asChild disabled={pagina >= totalPaginas}>
              <Link href={buildHref(Math.min(totalPaginas, pagina + 1))} aria-disabled={pagina >= totalPaginas}>
                Próxima <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmMarcarPago}
        onOpenChange={setConfirmMarcarPago}
        title={`Marcar ${selected.size} cobrança(s) como pagas?`}
        description={`Total: ${formatMoney(totalSelected)}. Esta ação grava a data de pagamento de hoje.`}
        confirmLabel="Marcar pagas"
        onConfirm={marcarPagas}
      />

      <ConfirmDialog
        open={confirmDisparar}
        onOpenChange={setConfirmDisparar}
        title={`Disparar régua para ${selected.size} cobrança(s)?`}
        description="Mensagens serão enfileiradas conforme a régua ativa de cada cliente."
        confirmLabel="Disparar régua"
        onConfirm={dispararRegua}
      />
    </>
  );
}

function statusToClass(status: string) {
  switch (status) {
    case "PAGO":
      return "status-pago";
    case "ATRASADO":
      return "status-atraso";
    case "ABERTO":
      return "status-aberto";
    case "CANCELADO":
      return "status-cancelado";
    case "PARCIAL":
      return "status-parcial";
    default:
      return "status-aberto";
  }
}
