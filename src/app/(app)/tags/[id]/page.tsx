import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Tag as TagIcon } from "lucide-react";
import { TagDetalheClient } from "./TagDetalheClient";

export const dynamic = "force-dynamic";

export default async function TagDetalhePage({ params }: { params: { id: string } }) {
  const tag = await prisma.tag.findUnique({
    where: { id: params.id },
    include: {
      textos: { orderBy: { titulo: "asc" } },
      _count: { select: { clientes: true } },
    },
  });
  if (!tag) notFound();

  const textoIds = tag.textos.map((t) => t.id);
  const agendamentos = textoIds.length
    ? await prisma.tagAgendamento.findMany({
        where: { tagTextoId: { in: textoIds } },
        orderBy: { dataExecucao: "asc" },
      })
    : [];

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const totais = {
    passados: agendamentos.filter((a) => new Date(a.dataExecucao) < hoje && !a.executado).length,
    futuros: agendamentos.filter((a) => new Date(a.dataExecucao) >= hoje && !a.executado).length,
    executados: agendamentos.filter((a) => a.executado).length,
    comErro: agendamentos.filter((a) => a.erro).length,
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <Link href="/tags" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Tags
      </Link>

      <div className="flex items-start gap-4 flex-wrap">
        <span
          className="h-8 w-8 rounded-full shrink-0 mt-2"
          style={{ background: tag.cor ?? "#84CC16" }}
          aria-hidden
        />
        <div>
          <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
            <TagIcon className="h-7 w-7" /> {tag.nome}
          </h1>
          <p className="text-muted-foreground">
            Categoria <strong>{tag.categoria}</strong> · origem <code>{tag.origem ?? "interno"}</code> ·{" "}
            <strong>{tag._count.clientes}</strong> cliente(s) marcado(s) com esta tag
          </p>
        </div>
      </div>

      {tag.descricao && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Descrição</CardTitle></CardHeader>
          <CardContent className="text-sm">{tag.descricao}</CardContent>
        </Card>
      )}

      <TagDetalheClient
        tagId={tag.id}
        nomeTag={tag.nome}
        textosIniciais={tag.textos.map((t) => ({
          id: t.id, titulo: t.titulo, texto: t.texto, canal: t.canal,
        }))}
        agendamentosIniciais={agendamentos.map((a) => ({
          id: a.id,
          tagTextoId: a.tagTextoId,
          dataExecucao: a.dataExecucao.toISOString(),
          horarioEnvio: a.horarioEnvio,
          executado: a.executado,
          executadoEm: a.executadoEm?.toISOString() ?? null,
          erro: a.erro,
        }))}
        totais={totais}
      />
    </div>
  );
}
