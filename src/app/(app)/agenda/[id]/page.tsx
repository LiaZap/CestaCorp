import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Ban, SkipForward } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const statusStyle: Record<string, string> = {
  PENDENTE: "status-pendente",
  CONCLUIDO: "status-pago",
  ATRASADO: "status-erro",
  ISENTO: "status-aberto",
  CANCELADO: "status-aberto",
};

export default async function EventoDetalhePage({ params }: { params: { id: string } }) {
  const evento = await prisma.eventoAgenda.findUnique({
    where: { id: params.id },
    include: {
      cliente: { select: { id: true, razaoSocial: true } },
      obrigacao: true,
    },
  });
  if (!evento) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/agenda" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Agenda
        </Link>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <h1 className="text-3xl font-bold text-cestacorp-blue">{evento.titulo}</h1>
          <span className={"status-badge " + statusStyle[evento.status]}>{evento.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Vencimento</p>
          <p className="text-2xl font-bold">{formatDate(evento.dataVencimento)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Tipo</p>
          <p className="text-2xl font-bold">{evento.obrigacao?.tipo ?? "—"}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs uppercase text-muted-foreground">Responsável</p>
          <p className="text-lg font-bold">{evento.responsavel ?? "—"}</p>
        </CardContent></Card>
      </div>

      {evento.cliente && (
        <Card>
          <CardHeader><CardTitle>Cliente</CardTitle></CardHeader>
          <CardContent>
            <Link href={`/clientes/${evento.cliente.id}`} className="font-medium hover:underline">
              {evento.cliente.razaoSocial}
            </Link>
          </CardContent>
        </Card>
      )}

      {evento.descricao && (
        <Card>
          <CardHeader><CardTitle>Descrição</CardTitle></CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{evento.descricao}</CardContent>
        </Card>
      )}

      {evento.status === "CONCLUIDO" && (
        <Card>
          <CardHeader><CardTitle>Conclusão</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Em:</span> {formatDateTime(evento.concluidoEm)}</p>
            <p><span className="text-muted-foreground">Por:</span> {evento.concluidoPor}</p>
            {evento.observacao && <p className="mt-2 bg-muted p-3 rounded">{evento.observacao}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Ações</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {evento.status !== "CONCLUIDO" && (
            <form action={`/api/agenda/eventos/${evento.id}/concluir`} method="post" className="flex gap-2 flex-wrap">
              <input
                type="text"
                name="observacao"
                placeholder="Observação (opcional)"
                className="h-10 rounded-md border bg-background px-3 text-sm min-w-60"
              />
              <Button type="submit">
                <CheckCircle2 className="h-4 w-4" /> Marcar como concluído
              </Button>
            </form>
          )}
          {evento.status !== "ISENTO" && evento.status !== "CONCLUIDO" && (
            <form action={`/api/agenda/eventos/${evento.id}/status`} method="post">
              <input type="hidden" name="status" value="ISENTO" />
              <Button type="submit" variant="outline">
                <SkipForward className="h-4 w-4" /> Marcar isento
              </Button>
            </form>
          )}
          {evento.status !== "CANCELADO" && (
            <form action={`/api/agenda/eventos/${evento.id}/status`} method="post">
              <input type="hidden" name="status" value="CANCELADO" />
              <Button type="submit" variant="destructive">
                <Ban className="h-4 w-4" /> Cancelar
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
