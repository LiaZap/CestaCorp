import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, FileText } from "lucide-react";
import { TiposContratoClient } from "./TiposContratoClient";

export const dynamic = "force-dynamic";

export default async function TiposContratoPage() {
  const tipos = await prisma.tipoContrato.findMany({
    orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { nome: "asc" }],
    include: { _count: { select: { templates: true } } },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/configuracoes"
        className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-3 w-3" /> Configurações
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <FileText className="h-7 w-7" /> Tipos de Contrato
        </h1>
        <p className="text-muted-foreground">
          Patrick (call 24/04 + chat 13/06): "queria cadastrar Aditivo como tipo".
          Cadastre tipos que vão aparecer no formulário de novo template e na geração
          em lote. Pra desativar sem perder histórico, marque como inativo.
        </p>
      </div>

      <TiposContratoClient
        tipos={tipos.map((t) => ({
          id: t.id,
          slug: t.slug,
          nome: t.nome,
          descricao: t.descricao,
          ativo: t.ativo,
          ordem: t.ordem,
          exigeOriginal: t.exigeOriginal,
          qtdTemplates: t._count.templates,
        }))}
      />
    </div>
  );
}
