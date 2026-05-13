import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { connectMongo } from "@/lib/db/mongo";
import { MessageLogModel } from "@/models/MessageLog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, formatMoney } from "@/lib/utils";
import { RefreshCw, Ban, ArrowLeft, CheckCircle2, Clock, AlertTriangle, SkipForward } from "lucide-react";
import { WhatsAppChat, type ChatMessage } from "@/components/WhatsAppChat";

export const dynamic = "force-dynamic";

const statusStyle: Record<string, string> = {
  PENDENTE: "status-pendente",
  ENVIADO: "status-pago",
  ERRO: "status-erro",
  PULADO: "status-aberto",
  CANCELADO: "status-aberto",
};

const statusIcon: Record<string, any> = {
  PENDENTE: Clock,
  ENVIADO: CheckCircle2,
  ERRO: AlertTriangle,
  PULADO: SkipForward,
  CANCELADO: Ban,
};

export default async function ExecucaoDetalhePage({ params }: { params: { id: string } }) {
  const exec = await prisma.execucaoRegua.findUnique({
    where: { id: params.id },
    include: {
      cliente: { include: { emails: true, telefones: true } },
      cobranca: true,
      passo: true,
      regua: { select: { id: true, nome: true } },
    },
  });
  if (!exec) notFound();

  await connectMongo();
  const logs = await MessageLogModel.find({ execucaoReguaId: exec.id }).sort({ createdAt: 1 }).lean();

  const Icon = statusIcon[exec.status];
  const canResend = exec.status === "ERRO" || exec.status === "CANCELADO";
  const canCancel = exec.status === "PENDENTE";

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/regua-cobranca" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Régua de Cobrança
        </Link>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <h1 className="text-3xl font-bold text-cestacorp-blue">{exec.passo.nome}</h1>
          <span className={"status-badge " + statusStyle[exec.status]}>
            <Icon className="h-3 w-3 mr-1" /> {exec.status}
          </span>
        </div>
        <p className="text-muted-foreground">
          Régua: <Link href={`/regua-cobranca/${exec.regua.id}`} className="hover:text-primary">{exec.regua.nome}</Link>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Cliente</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <Link href={`/clientes/${exec.cliente.id}`} className="font-medium hover:underline text-base">
                {exec.cliente.razaoSocial}
              </Link>
            </p>
            {exec.cliente.telefones[0] && (
              <p className="text-muted-foreground">📱 {exec.cliente.telefones[0].numero}</p>
            )}
            {exec.cliente.emails[0] && (
              <p className="text-muted-foreground">✉ {exec.cliente.emails[0].email}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cobrança</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {exec.cobranca ? (
              <>
                <p><span className="text-muted-foreground">Descrição:</span> {exec.cobranca.descricao ?? "—"}</p>
                <p><span className="text-muted-foreground">Vencimento:</span> {formatDate(exec.cobranca.vencimento)}</p>
                <p className="text-lg font-semibold">{formatMoney(Number(exec.cobranca.valor))}</p>
                <span className={"status-badge " + (exec.cobranca.status === "PAGO" ? "status-pago" : exec.cobranca.status === "ATRASADO" ? "status-atraso" : "status-aberto")}>
                  {exec.cobranca.status}
                </span>
              </>
            ) : <p className="text-muted-foreground">Sem cobrança vinculada</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Detalhes do envio</CardTitle>
          <CardDescription>Canal {exec.passo.canal} · Offset {exec.passo.offsetDias} dias</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Agendado para</p>
              <p className="font-medium">{formatDateTime(exec.agendadoPara)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Enviado em</p>
              <p className="font-medium">{formatDateTime(exec.enviadoEm)}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Template configurado</p>
            <pre className="bg-muted p-3 rounded-md text-xs whitespace-pre-wrap font-mono">{exec.passo.templateMsg}</pre>
          </div>

          {exec.mensagemFinal && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Mensagem enviada (renderizada)</p>
              <pre className="bg-primary/5 border border-primary/10 p-3 rounded-md text-xs whitespace-pre-wrap">{exec.mensagemFinal}</pre>
            </div>
          )}

          {exec.erro && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Erro</p>
              <pre className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-xs whitespace-pre-wrap">{exec.erro}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ações</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <form action={`/api/reguas/execucoes/${exec.id}/reenviar`} method="post">
            <Button type="submit" disabled={!canResend && exec.status !== "PENDENTE"}>
              <RefreshCw className="h-4 w-4" /> {exec.status === "PENDENTE" ? "Enviar agora" : "Reenviar"}
            </Button>
          </form>
          <form action={`/api/reguas/execucoes/${exec.id}/cancelar`} method="post">
            <Button type="submit" variant="outline" disabled={!canCancel}>
              <Ban className="h-4 w-4" /> Cancelar
            </Button>
          </form>
          {exec.cobranca && (
            <Button asChild variant="outline">
              <Link href={`/cobrancas/${exec.cobranca.id}`}>Ver cobrança</Link>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conversa com o cliente</CardTitle>
          <CardDescription>Histórico completo de mensagens via DIGISAC</CardDescription>
        </CardHeader>
        <CardContent>
          <WhatsAppChat
            clienteNome={exec.cliente.razaoSocial}
            clienteTelefone={exec.cliente.telefones[0]?.numero}
            messages={logs.map((l: any): ChatMessage => ({
              id: String(l._id),
              text: String(l.conteudo ?? ""),
              direcao: l.direcao,
              status: l.status,
              createdAt: l.createdAt,
              channel: l.canal,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
