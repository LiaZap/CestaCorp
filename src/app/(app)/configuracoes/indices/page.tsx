import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { IndicesClient } from "./IndicesClient";

export const dynamic = "force-dynamic";

export default async function IndicesPage() {
  const indices = await prisma.indiceCustomizado.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/configuracoes" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Configurações
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <TrendingUp className="h-7 w-7" /> Índices de reajuste customizados
        </h1>
        <p className="text-muted-foreground">
          Crie índices personalizados pra usar nos reajustes (além de IPCA / IGP-M / INPC / Fixo).
          Útil pra fixar percentuais negociados ou usar tabelas internas.
        </p>
      </div>

      <IndicesClient
        indices={indices.map((i) => ({
          id: i.id,
          slug: i.slug,
          nome: i.nome,
          descricao: i.descricao,
          tipo: i.tipo,
          valorFixo: i.valorFixo ? Number(i.valorFixo) : null,
          valoresMensais: (i.valoresMensais as any[]) ?? [],
          fonte: i.fonte,
          ativo: i.ativo,
        }))}
      />
    </div>
  );
}
