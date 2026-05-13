import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { ArrowLeft, FileSignature } from "lucide-react";
import { LoteLgpdClient } from "./LoteLgpdClient";

export const dynamic = "force-dynamic";

export default async function LoteLgpdPage() {
  const [templates, classifs, statusCounts] = await Promise.all([
    prisma.contratoTemplate.findMany({
      where: { ativo: true },
      orderBy: [{ lgpdAtual: "desc" }, { nome: "asc" }],
    }),
    prisma.cliente.groupBy({
      by: ["classificacao"],
      where: { status: "ATIVO" },
      _count: true,
    }),
    prisma.cliente.groupBy({
      by: ["status"],
      _count: true,
    }),
  ]);

  // Quantos clientes já têm contrato pra cada template (pra mostrar o "faltam")
  const cobertura = await Promise.all(
    templates.map(async (t) => {
      const total = await prisma.cliente.count({ where: { status: "ATIVO" } });
      const cobertos = await prisma.cliente.count({
        where: {
          status: "ATIVO",
          contratos: {
            some: {
              templateId: t.id,
              status: { in: ["EMITIDO", "ASSINADO"] },
            },
          },
        },
      });
      return { templateId: t.id, total, cobertos, faltam: total - cobertos };
    })
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <Link href="/contratos" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Contratos
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <FileSignature className="h-7 w-7" /> Geração em lote LGPD
        </h1>
        <p className="text-muted-foreground">
          Atualize todos os contratos para a versão atual com cláusulas LGPD. O sistema usa o
          <b> valor de honorário atual</b> (recorrência NIBO) e auto-aplica anexos por tag.
        </p>
      </div>

      <LoteLgpdClient
        templates={templates.map((t) => ({
          id: t.id,
          nome: t.nome,
          tipo: t.tipo,
          versao: t.versao,
          lgpdAtual: t.lgpdAtual,
        }))}
        cobertura={cobertura}
      />
    </div>
  );
}
