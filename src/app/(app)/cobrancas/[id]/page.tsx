import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { connectMongo } from "@/lib/db/mongo";
import { MessageLogModel } from "@/models/MessageLog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { ArrowLeft, CheckCircle2, RefreshCw, ExternalLink, Copy, Send, Calculator } from "lucide-react";
import { calcularValorAtualizadoComSnapshot, getConfigCobranca } from "@/lib/services/valor-atualizado";

export const dynamic = "force-dynamic";

export default async function CobrancaDetailPage({ params }: { params: { id: string } }) {
  const cobranca = await prisma.cobranca.findUnique({
    where: { id: params.id },
    include: {
      cliente: { include: { telefones: true, emails: true } },
      execucoes: {
        orderBy: { agendadoPara: "asc" },
        include: { passo: true },
      },
      honorario: true,
    },
  });
  if (!cobranca) notFound();

  await connectMongo();
  const logs = await MessageLogModel.find({ clienteId: cobranca.cliente.id })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

  const atrasoDias = Math.floor(
    (Date.now() - cobranca.vencimento.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Valor atualizado (juros + multa) — só calcula se ainda não foi pago.
  // Patrick (09/05): usa snapshot da cobrança (regra do dia em que entrou).
  const valorBruto = Number(cobranca.valor);
  const atualizacao = cobranca.status === "PAGO"
    ? null
    : await calcularValorAtualizadoComSnapshot(
        valorBruto,
        cobranca.vencimento,
        (cobranca as any).regraJurosSnapshot,
      );

  // Compara com a regra GLOBAL atual pra avisar se mudou desde que a cobrança nasceu
  const regraGlobalAtual = await getConfigCobranca();
  const regraOriginal = atualizacao?.config;
  const regraDivergente = atualizacao?.regraOrigem === "snapshot" && regraOriginal && (
    regraOriginal.jurosPctAoDia !== regraGlobalAtual.jurosPctAoDia
    || regraOriginal.multaPct !== regraGlobalAtual.multaPct
    || regraOriginal.carenciaDias !== regraGlobalAtual.carenciaDias
    || regraOriginal.jurosCompostos !== regraGlobalAtual.jurosCompostos
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link href={`/clientes/${cobranca.cliente.id}`} className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> {cobranca.cliente.razaoSocial}
        </Link>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <h1 className="text-3xl font-bold text-cestacorp-blue">
            {cobranca.descricao ?? "Cobrança"}
          </h1>
          <span className={"status-badge " + (cobranca.status === "PAGO" ? "status-pago" : cobranca.status === "ATRASADO" ? "status-atraso" : "status-aberto")}>
            {cobranca.status}
          </span>
          {cobranca.status === "ATRASADO" && (
            <span className="text-sm text-red-600 font-medium">{atrasoDias} dia(s) em atraso</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Valor bruto</p>
          <p className="text-2xl font-bold">{formatMoney(valorBruto)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Vencimento</p>
          <p className="text-2xl font-bold">{formatDate(cobranca.vencimento)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Pago em</p>
          <p className="text-2xl font-bold">{cobranca.dataPagamento ? formatDate(cobranca.dataPagamento) : "—"}</p>
        </CardContent></Card>
      </div>

      {atualizacao && atualizacao.emAtraso && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <Calculator className="h-5 w-5" /> Valor atualizado
            </CardTitle>
            <CardDescription>
              {atualizacao.diasAtraso} dia{atualizacao.diasAtraso !== 1 ? "s" : ""} de atraso ·
              {" "}{atualizacao.config.multaPct}% multa + {atualizacao.config.jurosPctAoDia}% juros/dia
              {atualizacao.config.carenciaDias > 0 ? ` · carência ${atualizacao.config.carenciaDias}d` : null}
              {atualizacao.regraOrigem === "snapshot" && (
                <span className="ml-1 text-[11px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                  regra original da cobrança
                </span>
              )}
              {atualizacao.regraOrigem === "global" && (
                <span className="ml-1 text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                  regra atual (cobrança legada sem snapshot)
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bruto</p>
                <p className="text-lg font-semibold tabular-nums">{formatMoney(atualizacao.bruto)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Multa</p>
                <p className="text-lg font-semibold tabular-nums text-amber-700">+ {formatMoney(atualizacao.multa)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Juros</p>
                <p className="text-lg font-semibold tabular-nums text-amber-700">+ {formatMoney(atualizacao.juros)}</p>
              </div>
              <div className="border-l-2 border-cestacorp-blue pl-4">
                <p className="text-[10px] uppercase tracking-wider text-cestacorp-blue font-bold">Hoje pagaria</p>
                <p className="text-2xl font-bold tabular-nums text-cestacorp-blue">{formatMoney(atualizacao.total)}</p>
              </div>
            </div>

            {regraDivergente && (
              <div className="mt-3 rounded-md bg-amber-100 border border-amber-300 p-2.5 text-[11px] text-amber-900">
                <b>⚠ A regra global mudou.</b> Esta cobrança usa a regra do dia em que foi gerada
                ({atualizacao.config.jurosPctAoDia}% juros + {atualizacao.config.multaPct}% multa,
                carência {atualizacao.config.carenciaDias}d).
                Regra atual é {regraGlobalAtual.jurosPctAoDia}% juros + {regraGlobalAtual.multaPct}% multa,
                carência {regraGlobalAtual.carenciaDias}d. Mudança é prospectiva — vale só pra novas cobranças.
              </div>
            )}

            <p className="text-[11px] text-muted-foreground mt-3">
              Cálculo automático segundo a regra padrão Cestacorp.{" "}
              <Link href="/configuracoes/cobranca" className="text-cestacorp-blue hover:underline">
                Editar regra →
              </Link>
            </p>
          </CardContent>
        </Card>
      )}

      {(cobranca.linhaDigitavel || cobranca.urlBoleto || cobranca.pixCopiaCola) && (
        <Card>
          <CardHeader><CardTitle>Dados para pagamento</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {cobranca.linhaDigitavel && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Linha digitável</p>
                <pre className="bg-muted p-2 rounded font-mono text-xs break-all">{cobranca.linhaDigitavel}</pre>
              </div>
            )}
            {cobranca.pixCopiaCola && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">PIX copia-e-cola</p>
                <pre className="bg-muted p-2 rounded font-mono text-xs break-all">{cobranca.pixCopiaCola}</pre>
              </div>
            )}
            {cobranca.urlBoleto && (
              <Button asChild variant="outline" size="sm">
                <a href={cobranca.urlBoleto} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Abrir boleto
                </a>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ações manuais</CardTitle>
          <CardDescription>Atalho para operação — registra autor nos logs</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {cobranca.status !== "PAGO" && (
            <form action={`/api/cobrancas/${cobranca.id}/marcar-paga`} method="post">
              <Button type="submit">
                <CheckCircle2 className="h-4 w-4" /> Marcar como paga
              </Button>
            </form>
          )}
          <form action={`/api/cobrancas/${cobranca.id}/sincronizar`} method="post">
            <Button type="submit" variant="outline">
              <RefreshCw className="h-4 w-4" /> Sincronizar do NIBO
            </Button>
          </form>
          <form action={`/api/cobrancas/${cobranca.id}/enviar-agora`} method="post">
            <Button type="submit" variant="secondary">
              <Send className="h-4 w-4" /> Cobrar agora (WhatsApp)
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Passos da régua</CardTitle>
          <CardDescription>{cobranca.execucoes.length} passos agendados/executados</CardDescription>
        </CardHeader>
        <CardContent>
          {cobranca.execucoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum passo agendado.</p>
          ) : (
            <ul className="divide-y text-sm">
              {cobranca.execucoes.map((e) => (
                <li key={e.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <Link href={`/regua-cobranca/execucao/${e.id}`} className="font-medium hover:underline">
                      {e.passo.nome}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(e.agendadoPara)} · {e.passo.canal}
                    </p>
                  </div>
                  <span className={"status-badge " + (e.status === "ENVIADO" ? "status-pago" : e.status === "ERRO" ? "status-erro" : "status-pendente")}>
                    {e.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
