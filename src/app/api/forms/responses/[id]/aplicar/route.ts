import { NextRequest, NextResponse } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { FormResponseModel } from "@/models/FormResponse";
import { FormDefinitionModel } from "@/models/FormDefinition";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { notificar } from "@/lib/services/notifications";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { isDocumentoValido, soDigitos, formatarDocumento } from "@/lib/security/documento";

/**
 * Aplica uma resposta de formulário ao cadastro:
 *  - Usa mapping dos fields (entity: "cliente" | "socio" | "contato") para
 *    montar objetos e criar/atualizar no Postgres
 *  - Marca a FormResponse como APLICADO
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  await connectMongo();
  const resposta: any = await FormResponseModel.findById(params.id).lean();
  if (!resposta) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  const form: any = await FormDefinitionModel.findOne({ slug: resposta.formSlug }).lean();
  if (!form) return NextResponse.json({ error: "formulário não encontrado" }, { status: 404 });

  const clienteData: Record<string, any> = {};
  const socioData: Record<string, any> = {};
  for (const f of form.fields) {
    if (!f.mapping) continue;
    const value = resposta.answers?.[f.key];
    if (value == null || value === "") continue;
    if (f.mapping.entity === "cliente") clienteData[f.mapping.field] = value;
    else if (f.mapping.entity === "socio") socioData[f.mapping.field] = value;
  }

  // resolve CPF/CNPJ para localizar ou criar cliente
  const docRaw = soDigitos(String(clienteData.cpfCnpj ?? socioData.cpf ?? ""));
  if (!docRaw) return NextResponse.json({ error: "Sem CPF/CNPJ para aplicar" }, { status: 400 });
  if (!isDocumentoValido(docRaw)) {
    return NextResponse.json({ error: "CPF/CNPJ inválido (dígitos verificadores não conferem)" }, { status: 400 });
  }
  const cpfCnpj = formatarDocumento(docRaw);

  const cliente = await prisma.cliente.upsert({
    where: { cpfCnpj },
    update: {
      razaoSocial: clienteData.razaoSocial || undefined,
      nomeFantasia: clienteData.nomeFantasia || undefined,
    },
    create: {
      razaoSocial: clienteData.razaoSocial || resposta.autor?.nome || "(sem razão)",
      nomeFantasia: clienteData.nomeFantasia || null,
      cpfCnpj,
      tipoPessoa: docRaw.length === 11 ? "FISICA" : "JURIDICA",
      status: "PROSPECT",
      emails: resposta.autor?.email ? { create: [{ email: resposta.autor.email, principal: true }] } : undefined,
      telefones: resposta.autor?.telefone ? { create: [{ numero: resposta.autor.telefone, principal: true, whatsapp: true }] } : undefined,
    },
  });

  // cria sócio se houver dados de sócio (com validação)
  if (socioData.nome && socioData.cpf) {
    const cpfSocioRaw = soDigitos(String(socioData.cpf));
    if (isDocumentoValido(cpfSocioRaw)) {
      const cpfSocio = formatarDocumento(cpfSocioRaw);
      const existente = await prisma.socio.findFirst({ where: { clienteId: cliente.id, cpf: cpfSocio } });
      if (!existente) {
        await prisma.socio.create({
          data: {
            clienteId: cliente.id,
            nome: String(socioData.nome),
            cpf: cpfSocio,
            profissao: socioData.profissao ? String(socioData.profissao) : undefined,
          },
        });
      }
    }
  }

  await FormResponseModel.updateOne(
    { _id: params.id },
    { $set: { status: "APLICADO", aplicadoEm: new Date(), aplicadoPor: (session.user as any).id, clienteId: cliente.id } }
  );

  // Cliente recém-criado (PROSPECT) → notifica para avaliação
  if (cliente.status === "PROSPECT") {
    await notificar({
      tipo: "CLIENTE_PROSPECT",
      titulo: `Novo prospect: ${cliente.razaoSocial}`,
      descricao: `Criado a partir do formulário ${resposta.formSlug}`,
      href: `/clientes/${cliente.id}`,
      clienteId: cliente.id,
    });
  }

  return NextResponse.redirect(
    new URL(`/clientes/${cliente.id}`, process.env.NEXTAUTH_URL || "http://localhost:3000"),
    303
  );
}
