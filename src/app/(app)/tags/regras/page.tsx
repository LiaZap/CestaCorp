import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Zap } from "lucide-react";
import { RegrasClient } from "./RegrasClient";

export const dynamic = "force-dynamic";

export default async function RegrasTagPage() {
  const [regras, tags] = await Promise.all([
    prisma.regraTag.findMany({
      orderBy: [{ ativa: "desc" }, { createdAt: "desc" }],
      include: { tag: { select: { nome: true, cor: true } } },
    }),
    prisma.tag.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true, cor: true } }),
  ]);

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/tags" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Tags
      </Link>
      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <Zap className="h-7 w-7" /> Regras automáticas
        </h1>
        <p className="text-muted-foreground">
          Aplica ou remove tags automaticamente conforme condições. Roda diariamente no cron.
        </p>
      </div>
      <RegrasClient
        regras={regras.map((r) => ({
          id: r.id,
          nome: r.nome,
          tagId: r.tagId,
          tagNome: r.tag.nome,
          tagCor: r.tag.cor ?? "#84CC16",
          condicao: r.condicao,
          params: r.params as any,
          acao: r.acao,
          ativa: r.ativa,
          totalAplicacoes: r.totalAplicacoes,
          ultimaExecucao: r.ultimaExecucao?.toISOString() ?? null,
        }))}
        tags={tags.map((t) => ({ id: t.id, nome: t.nome, cor: t.cor ?? "#84CC16" }))}
      />
    </div>
  );
}
