import { prisma } from "@/lib/db/prisma";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { BatchContratoForm } from "./BatchContratoForm";

export const dynamic = "force-dynamic";

export default async function ContratosEmLotePage() {
  const [clientes, templates] = await Promise.all([
    prisma.cliente.findMany({
      where: { status: "ATIVO" },
      orderBy: { razaoSocial: "asc" },
      select: {
        id: true,
        razaoSocial: true,
        cpfCnpj: true,
        classificacao: true,
        _count: { select: { contratos: true } },
      },
    }),
    prisma.contratoTemplate.findMany({ where: { ativo: true }, orderBy: { nome: "asc" } }),
  ]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link href="/contratos" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Contratos
        </Link>
        <h1 className="text-3xl font-bold text-cestacorp-blue mt-2">Gerar contratos em lote</h1>
        <p className="text-muted-foreground">
          Selecione o template e os clientes. Um contrato .docx será gerado para cada cliente selecionado.
        </p>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Sem templates ativos</CardTitle>
            <CardDescription>Faça upload de um template antes de gerar em lote.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/contratos/templates/novo" className="text-primary hover:underline">
              Criar novo template →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <BatchContratoForm
          clientes={clientes.map((c) => ({
            id: c.id,
            razaoSocial: c.razaoSocial,
            cpfCnpj: c.cpfCnpj,
            classificacao: c.classificacao,
            qtdContratos: c._count.contratos,
          }))}
          templates={templates.map((t) => ({ id: t.id, nome: t.nome, tipo: t.tipo }))}
        />
      )}
    </div>
  );
}
