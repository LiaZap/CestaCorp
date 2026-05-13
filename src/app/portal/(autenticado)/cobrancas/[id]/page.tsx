import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Copy } from "lucide-react";
import { formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PortalCobrancaDetail({ params }: { params: { id: string } }) {
  const session = await auth();
  const u = session!.user as any;

  const cobranca = await prisma.cobranca.findFirst({
    where: { id: params.id, clienteId: u.clienteId },
  });
  if (!cobranca) notFound();

  const atrasoDias = Math.floor(
    (Date.now() - cobranca.vencimento.getTime()) / 86400000
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/portal/cobrancas" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Meus boletos
        </Link>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <h1 className="text-3xl font-bold text-cestacorp-blue">{cobranca.descricao ?? "Honorários"}</h1>
          <span className={"status-badge " + (cobranca.status === "PAGO" ? "status-pago" : cobranca.status === "ATRASADO" ? "status-atraso" : "status-aberto")}>
            {cobranca.status}
          </span>
          {cobranca.status === "ATRASADO" && (
            <span className="text-sm text-red-600 font-medium">{atrasoDias} dia(s) em atraso</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Valor</p>
          <p className="text-2xl font-bold">{formatMoney(Number(cobranca.valor))}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Vencimento</p>
          <p className="text-2xl font-bold">{formatDate(cobranca.vencimento)}</p>
        </CardContent></Card>
        {cobranca.dataPagamento && (
          <Card><CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground">Pago em</p>
            <p className="text-2xl font-bold">{formatDate(cobranca.dataPagamento)}</p>
          </CardContent></Card>
        )}
      </div>

      {cobranca.status !== "PAGO" && (cobranca.linhaDigitavel || cobranca.urlBoleto || cobranca.pixCopiaCola) && (
        <Card>
          <CardHeader><CardTitle>Dados para pagamento</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            {cobranca.pixCopiaCola && (
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Copy className="h-3 w-3" /> PIX copia-e-cola
                </p>
                <code className="block bg-muted p-3 rounded break-all text-xs">{cobranca.pixCopiaCola}</code>
              </div>
            )}
            {cobranca.linhaDigitavel && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Linha digitável</p>
                <code className="block bg-muted p-3 rounded break-all font-mono text-xs">{cobranca.linhaDigitavel}</code>
              </div>
            )}
            {cobranca.urlBoleto && (
              <Button asChild size="lg">
                <a href={cobranca.urlBoleto} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Abrir boleto em nova aba
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Dúvidas?</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Entre em contato com a equipe Cestacorp pelos canais habituais.</p>
        </CardContent>
      </Card>
    </div>
  );
}
