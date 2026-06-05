import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, Settings, Globe, User } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ListaObrigacoesPage() {
  const obrigacoes = await prisma.obrigacao.findMany({
    orderBy: [{ ativa: "desc" }, { tipo: "asc" }, { nome: "asc" }],
    include: {
      cliente: { select: { razaoSocial: true } },
      _count: { select: { eventos: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/agenda" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Agenda
        </Link>
        <div className="flex items-center justify-between flex-wrap gap-3 mt-2">
          <div>
            <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
              <Settings className="h-7 w-7" /> Obrigações
            </h1>
            <p className="text-muted-foreground">
              Lembretes <strong>antecipados</strong> pro cliente — não tarefa da equipe.
              Quando uma obrigação dispara, manda mensagem WhatsApp + iCal pra agenda dele.
            </p>
          </div>
          <Button asChild>
            <Link href="/agenda/nova">
              <Plus className="h-4 w-4" /> Nova obrigação
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{obrigacoes.length} obrigações cadastradas</CardTitle>
          <CardDescription>
            Cada obrigação tem um <strong>cronograma de lembretes</strong> que vai pro cliente
            (não pra equipe). Coluna <strong>"# clientes"</strong> mostra quantos vão receber
            no próximo disparo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {obrigacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma obrigação cadastrada. <Link href="/agenda/nova" className="text-primary hover:underline">Criar a primeira</Link>.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3">Tipo</th>
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">Recorrência</th>
                  <th className="py-2 pr-3">Alcance</th>
                  <th className="py-2 pr-3">Eventos</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {obrigacoes.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-2 pr-3"><span className="status-badge status-aberto text-[10px]">{o.tipo}</span></td>
                    <td className="py-2 pr-3">
                      <Link href={`/agenda/obrigacoes/${o.id}/editar`} className="font-medium hover:underline">
                        {o.nome}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      {o.recorrencia}
                      {o.recorrencia === "MENSAL" && o.diaVencimento ? ` (dia ${o.diaVencimento})` : ""}
                      {o.recorrencia === "ANUAL" && o.mesVencimento ? ` (${o.diaVencimentoAnual}/${o.mesVencimento})` : ""}
                    </td>
                    <td className="py-2 pr-3">
                      {o.global ? (
                        <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" /> Global</span>
                      ) : (
                        <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {o.cliente?.razaoSocial ?? "—"}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">{o._count.eventos}</td>
                    <td className="py-2 pr-3">
                      <span className={"status-badge " + (o.ativa ? "status-ativo" : "status-aberto")}>
                        {o.ativa ? "ativa" : "pausada"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
