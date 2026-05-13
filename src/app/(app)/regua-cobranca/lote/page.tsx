import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { ArrowLeft, Megaphone } from "lucide-react";
import { LoteClient } from "./LoteClient";

export const dynamic = "force-dynamic";

export default async function EnvioLotePage() {
  const cobrancasEmAtraso = await prisma.cobranca.findMany({
    where: { status: { in: ["ATRASADO", "ABERTO"] } },
    orderBy: { vencimento: "asc" },
    include: {
      cliente: {
        select: {
          id: true, razaoSocial: true, nomeFantasia: true, cpfCnpj: true, classificacao: true,
          telefones: { where: { whatsapp: true, principal: true }, take: 1 },
        },
      },
    },
  });

  const itens = cobrancasEmAtraso.map((c) => ({
    cobrancaId: c.id,
    clienteId: c.cliente.id,
    razaoSocial: c.cliente.razaoSocial,
    nomeFantasia: c.cliente.nomeFantasia,
    cpfCnpj: c.cliente.cpfCnpj,
    classificacao: c.cliente.classificacao,
    telefone: c.cliente.telefones[0]?.numero,
    descricao: c.descricao ?? "Honorários",
    valor: Number(c.valor),
    vencimento: c.vencimento.toISOString(),
    status: c.status,
    diasAtraso: Math.floor((Date.now() - c.vencimento.getTime()) / 86400000),
    pix: c.pixCopiaCola,
    boleto: c.urlBoleto,
  }));

  return (
    <div className="space-y-6 max-w-6xl">
      <Link href="/regua-cobranca" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Régua de Cobrança
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <Megaphone className="h-7 w-7" /> Envio em lote
        </h1>
        <p className="text-muted-foreground">
          Selecione clientes com cobranças em atraso/aberto e dispare uma mensagem personalizada via WhatsApp.
          Cada cliente recebe o template com seus próprios dados.
        </p>
      </div>

      <LoteClient itens={itens} />
    </div>
  );
}
