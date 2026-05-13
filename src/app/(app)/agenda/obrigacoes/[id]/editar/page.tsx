import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Trash2, Save } from "lucide-react";

export const dynamic = "force-dynamic";

async function salvarObrigacao(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  await prisma.obrigacao.update({
    where: { id },
    data: {
      nome: String(formData.get("nome")),
      descricao: String(formData.get("descricao") ?? "") || null,
      ativa: formData.get("ativa") === "on",
      diaVencimento: formData.get("diaVencimento") ? Number(formData.get("diaVencimento")) : null,
      mesVencimento: formData.get("mesVencimento") ? Number(formData.get("mesVencimento")) : null,
      diaVencimentoAnual: formData.get("diaVencimentoAnual") ? Number(formData.get("diaVencimentoAnual")) : null,
      antecedenciaDias: Number(formData.get("antecedenciaDias") ?? 7),
      responsavel: String(formData.get("responsavel") ?? "") || null,
      tributacaoFiltro: String(formData.get("tributacaoFiltro") ?? "") || null,
    },
  });
  redirect("/agenda/obrigacoes");
}

async function excluirObrigacao(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const eventos = await prisma.eventoAgenda.count({ where: { obrigacaoId: id } });
  if (eventos > 0) {
    await prisma.obrigacao.update({ where: { id }, data: { ativa: false } });
  } else {
    await prisma.obrigacao.delete({ where: { id } });
  }
  redirect("/agenda/obrigacoes");
}

export default async function EditarObrigacaoPage({ params }: { params: { id: string } }) {
  const o = await prisma.obrigacao.findUnique({
    where: { id: params.id },
    include: { cliente: { select: { razaoSocial: true } }, _count: { select: { eventos: true } } },
  });
  if (!o) notFound();

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/agenda/obrigacoes" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Obrigações
      </Link>
      <h1 className="text-3xl font-bold text-cestacorp-blue">Editar obrigação</h1>
      <p className="text-muted-foreground">
        Tipo <b>{o.tipo}</b> · {o.recorrencia} · {o._count.eventos} evento(s) gerado(s)
        {o.cliente ? ` · cliente ${o.cliente.razaoSocial}` : " · aplicação global"}
      </p>

      <form action={salvarObrigacao}>
        <input type="hidden" name="id" value={o.id} />
        <Card>
          <CardHeader><CardTitle>Informações</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-1">
              <Label>Nome</Label>
              <Input name="nome" defaultValue={o.nome} required />
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label>Descrição</Label>
              <textarea name="descricao" defaultValue={o.descricao ?? ""} className="w-full min-h-20 rounded-md border bg-background p-3 text-sm" />
            </div>
            {(o.recorrencia === "MENSAL" || o.recorrencia === "TRIMESTRAL") && (
              <div className="space-y-1">
                <Label>Dia do vencimento</Label>
                <Input type="number" name="diaVencimento" min={1} max={31} defaultValue={o.diaVencimento ?? ""} />
              </div>
            )}
            {o.recorrencia === "ANUAL" && (
              <>
                <div className="space-y-1">
                  <Label>Mês</Label>
                  <Input type="number" name="mesVencimento" min={1} max={12} defaultValue={o.mesVencimento ?? ""} />
                </div>
                <div className="space-y-1">
                  <Label>Dia</Label>
                  <Input type="number" name="diaVencimentoAnual" min={1} max={31} defaultValue={o.diaVencimentoAnual ?? ""} />
                </div>
              </>
            )}
            <div className="space-y-1">
              <Label>Antecedência da notificação (dias)</Label>
              <Input type="number" name="antecedenciaDias" min={0} max={60} defaultValue={o.antecedenciaDias} />
            </div>
            <div className="space-y-1">
              <Label>Responsável</Label>
              <Input name="responsavel" defaultValue={o.responsavel ?? ""} />
            </div>
            {o.global && (
              <div className="md:col-span-2 space-y-1">
                <Label>Filtro por tributação (contém)</Label>
                <Input name="tributacaoFiltro" defaultValue={o.tributacaoFiltro ?? ""} placeholder="Ex.: Simples" />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm md:col-span-2 pt-2">
              <input type="checkbox" name="ativa" defaultChecked={o.ativa} />
              Obrigação ativa (quando pausada, nenhum evento novo é gerado)
            </label>
          </CardContent>
        </Card>

        <div className="flex justify-between mt-4">
          <Button type="submit"><Save className="h-4 w-4" /> Salvar</Button>
        </div>
      </form>

      <form action={excluirObrigacao}>
        <input type="hidden" name="id" value={o.id} />
        <Button type="submit" variant="destructive" size="sm">
          <Trash2 className="h-4 w-4" />
          {o._count.eventos > 0 ? "Pausar (há histórico)" : "Excluir"}
        </Button>
      </form>
    </div>
  );
}
