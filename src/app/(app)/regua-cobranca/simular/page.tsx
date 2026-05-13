import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Beaker } from "lucide-react";
import { SimuladorClient } from "./SimuladorClient";

export const dynamic = "force-dynamic";

export default async function SimularPage({ searchParams }: { searchParams: { reguaId?: string; clienteId?: string } }) {
  const [reguas, clientes] = await Promise.all([
    prisma.reguaCobranca.findMany({
      where: { ativa: true },
      include: { passos: { orderBy: { ordem: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.cliente.findMany({
      where: { status: "ATIVO" },
      orderBy: { razaoSocial: "asc" },
      select: {
        id: true, razaoSocial: true, nomeFantasia: true, cpfCnpj: true,
        telefones: { where: { principal: true }, take: 1 },
        cobrancas: {
          where: { status: { in: ["ABERTO", "ATRASADO"] } },
          orderBy: { vencimento: "asc" },
          take: 1,
        },
      },
    }),
  ]);

  const reguaSelecionada = searchParams.reguaId
    ? reguas.find((r) => r.id === searchParams.reguaId)
    : reguas[0];

  return (
    <div className="space-y-6 max-w-6xl">
      <Link href="/regua-cobranca" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Régua de Cobrança
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <Beaker className="h-7 w-7" /> Simulador de envio
        </h1>
        <p className="text-muted-foreground">
          Escolha um cliente real e veja como ficariam as mensagens de cada passo da régua.
          Útil para treinar a equipe e validar templates.
        </p>
      </div>

      {reguas.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Nenhuma régua ativa. <Link href="/regua-cobranca/nova" className="text-primary hover:underline">Crie a primeira</Link>.
          </CardContent>
        </Card>
      ) : (
        <SimuladorClient
          reguas={reguas.map((r) => ({
            id: r.id,
            nome: r.nome,
            passos: r.passos.map((p) => ({
              id: p.id,
              nome: p.nome,
              offsetDias: p.offsetDias,
              canal: p.canal as any,
              horarioEnvio: p.horarioEnvio ?? "09:00",
              templateMsg: p.templateMsg,
            })),
          }))}
          clientes={clientes.map((c) => ({
            id: c.id,
            razaoSocial: c.razaoSocial,
            nomeFantasia: c.nomeFantasia,
            cpfCnpj: c.cpfCnpj,
            telefone: c.telefones[0]?.numero,
            cobranca: c.cobrancas[0]
              ? {
                  descricao: c.cobrancas[0].descricao ?? "Honorários",
                  valor: Number(c.cobrancas[0].valor),
                  vencimento: c.cobrancas[0].vencimento.toISOString(),
                  linhaDigitavel: c.cobrancas[0].linhaDigitavel ?? undefined,
                  urlBoleto: c.cobrancas[0].urlBoleto ?? undefined,
                  pixCopiaCola: c.cobrancas[0].pixCopiaCola ?? undefined,
                }
              : null,
          }))}
          reguaIdInicial={reguaSelecionada?.id}
          clienteIdInicial={searchParams.clienteId}
        />
      )}
    </div>
  );
}
