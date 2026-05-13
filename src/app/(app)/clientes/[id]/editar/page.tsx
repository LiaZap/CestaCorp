import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { ClienteForm } from "../../ClienteForm";

export const dynamic = "force-dynamic";

export default async function EditarClientePage({ params }: { params: { id: string } }) {
  const cliente = await prisma.cliente.findUnique({
    where: { id: params.id },
    include: { emails: true, telefones: true },
  });
  if (!cliente) notFound();

  const emailPrincipal = cliente.emails.find((e) => e.principal)?.email ?? cliente.emails[0]?.email;
  const telefonePrincipal = cliente.telefones.find((t) => t.principal)?.numero ?? cliente.telefones[0]?.numero;

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-cestacorp-blue">Editar cliente</h1>
      <ClienteForm
        defaults={{
          id: cliente.id,
          razaoSocial: cliente.razaoSocial,
          nomeFantasia: cliente.nomeFantasia ?? "",
          cpfCnpj: cliente.cpfCnpj,
          tipoPessoa: cliente.tipoPessoa,
          classificacao: cliente.classificacao,
          status: cliente.status,
          mesAniversarioReajuste: cliente.mesAniversarioReajuste,
          indiceReajuste: cliente.indiceReajuste,
          respFiscal: cliente.respFiscal ?? "",
          respFolha: cliente.respFolha ?? "",
          respContabil: cliente.respContabil ?? "",
          emailPrincipal,
          telefonePrincipal,
          niboCustomerId: cliente.niboCustomerId ?? "",
          digisacContactId: cliente.digisacContactId ?? "",
        }}
      />
    </div>
  );
}
