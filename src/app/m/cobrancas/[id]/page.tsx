import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatMoney } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, AlertCircle, Clock, CreditCard, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Mobile detail de cobrança em tela cheia (#57).
 * Mostra valor, status, prazo e atalhos rápidos. Link pra desktop pra fluxo completo.
 */
export default async function MobileCobrancaDetalhe({ params }: { params: { id: string } }) {
  const cobranca = await prisma.cobranca.findUnique({
    where: { id: params.id },
    include: {
      cliente: { select: { id: true, razaoSocial: true, nomeFantasia: true } },
      honorario: { select: { competencia: true } },
    },
  });
  if (!cobranca) notFound();

  const atrasoDias = Math.floor((Date.now() - cobranca.vencimento.getTime()) / 86400000);
  const status = cobranca.status;

  const statusVisual = status === "PAGO"
    ? { bg: "from-emerald-500 to-emerald-700", icon: CheckCircle2, label: "Pago" }
    : status === "ATRASADO"
      ? { bg: "from-red-500 to-red-700", icon: AlertCircle, label: `${atrasoDias} dia(s) em atraso` }
      : { bg: "from-amber-500 to-amber-700", icon: Clock, label: `Vence em ${formatDate(cobranca.vencimento)}` };

  const Icon = statusVisual.icon;

  return (
    <>
      <Link href="/m/cobrancas" className="text-xs text-muted-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Cobranças
      </Link>

      <section className={"rounded-2xl bg-gradient-to-br text-white p-5 shadow-lg " + statusVisual.bg}>
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase opacity-80 tracking-wider">{statusVisual.label}</p>
            <p className="text-3xl font-bold mt-1">{formatMoney(Number(cobranca.valor))}</p>
          </div>
          <Icon className="h-7 w-7 opacity-70 shrink-0" aria-hidden="true" />
        </div>
        <p className="text-xs opacity-90 mt-3 truncate">
          {cobranca.descricao ?? "Honorário"}
          {cobranca.honorario?.competencia && ` · ${cobranca.honorario.competencia}`}
        </p>
      </section>

      <section className="rounded-2xl bg-white border p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Cliente</span>
          <Link href={`/m/clientes/${cobranca.cliente.id}`} className="text-sm font-semibold text-cestacorp-blue truncate max-w-[60%] text-right">
            {cobranca.cliente.nomeFantasia ?? cobranca.cliente.razaoSocial}
          </Link>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Vencimento</span>
          <span className="text-sm font-medium">{formatDate(cobranca.vencimento)}</span>
        </div>
        {cobranca.dataPagamento && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Pago em</span>
            <span className="text-sm font-medium">{formatDate(cobranca.dataPagamento)}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Status</span>
          <span className={"status-badge text-[10px] " + (status === "PAGO" ? "status-pago" : status === "ATRASADO" ? "status-atraso" : "status-aberto")}>
            {status}
          </span>
        </div>
      </section>

      {cobranca.urlBoleto && (
        <Link
          href={cobranca.urlBoleto}
          target="_blank"
          className="flex items-center justify-center gap-2 rounded-xl bg-cestacorp-blue text-white font-semibold py-3 active:scale-[0.98] transition"
        >
          <CreditCard className="h-5 w-5" aria-hidden="true" />
          Abrir boleto
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}

      <Link
        href={`/cobrancas/${cobranca.id}`}
        className="block text-center text-sm text-cestacorp-blue underline py-3"
      >
        Ver detalhes completos no desktop
      </Link>
    </>
  );
}
