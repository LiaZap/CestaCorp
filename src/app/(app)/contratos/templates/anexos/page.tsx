import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Tag as TagIcon } from "lucide-react";
import { AnexosClient } from "./AnexosClient";

export const dynamic = "force-dynamic";

export default async function AnexosContratoPage() {
  const [anexos, tags] = await Promise.all([
    prisma.contratoAnexo.findMany({
      orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { nome: "asc" }],
    }),
    prisma.tag.findMany({ select: { slug: true, nome: true, categoria: true } }),
  ]);

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/contratos/templates" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Templates
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <FileText className="h-7 w-7" /> Anexos de contrato
        </h1>
        <p className="text-muted-foreground">
          Anexos extras (LGPD, NDA, regra fiscal especial). Vincule a contratos individualmente
          ou marque tags para auto-aplicação na geração em lote.
        </p>
      </div>

      <AnexosClient
        anexos={anexos.map((a) => ({
          id: a.id,
          nome: a.nome,
          descricao: a.descricao,
          arquivoDocx: a.arquivoDocx,
          ordem: a.ordem,
          ativo: a.ativo,
          autoAplicarTags: a.autoAplicarTags,
        }))}
        tagsDisponiveis={tags.map((t) => ({ slug: t.slug, nome: t.nome, categoria: t.categoria }))}
      />
    </div>
  );
}
