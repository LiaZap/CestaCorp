import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { assertOwnership, assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { isDocumentoValido } from "@/lib/security/documento";

const ClienteSchema = z.object({
  razaoSocial: z.string().min(2),
  nomeFantasia: z.string().optional().nullable(),
  cpfCnpj: z.string().min(11).refine(isDocumentoValido, {
    message: "CPF/CNPJ inválido (dígitos verificadores não conferem)",
  }),
  tipoPessoa: z.enum(["FISICA", "JURIDICA", "MEI"]).optional(),
  classificacao: z.enum(["BRONZE", "PRATA", "OURO", "TOP"]).optional().nullable(),
  status: z.enum(["ATIVO", "INATIVO", "ENCERRADO", "PROSPECT", "SUSPENSO"]).optional(),
  mesAniversarioReajuste: z.number().int().min(1).max(12).optional().nullable(),
  indiceReajuste: z.enum(["IPCA", "IGPM", "INPC", "FIXO"]).optional().nullable(),
  respFiscal: z.string().optional().nullable(),
  respFolha: z.string().optional().nullable(),
  respContabil: z.string().optional().nullable(),
  emailPrincipal: z.string().email().optional().or(z.literal("")),
  telefonePrincipal: z.string().optional(),
  niboCustomerId: z.string().optional().nullable(),
  digisacContactId: z.string().optional().nullable(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    await assertOwnership(session, "cliente", params.id);
  } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id: params.id },
    include: { emails: true, telefones: true, socios: true },
  });
  if (!cliente) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json(cliente);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Edição só para equipe
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = ClienteSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  await prisma.$transaction(async (tx) => {
    await tx.cliente.update({
      where: { id: params.id },
      data: {
        razaoSocial: d.razaoSocial,
        nomeFantasia: d.nomeFantasia || null,
        cpfCnpj: d.cpfCnpj,
        tipoPessoa: d.tipoPessoa ?? undefined,
        classificacao: d.classificacao ?? null,
        status: d.status ?? undefined,
        mesAniversarioReajuste: d.mesAniversarioReajuste ?? null,
        indiceReajuste: d.indiceReajuste ?? undefined,
        respFiscal: d.respFiscal || null,
        respFolha: d.respFolha || null,
        respContabil: d.respContabil || null,
        niboCustomerId: d.niboCustomerId || null,
        digisacContactId: d.digisacContactId || null,
      },
    });

    if (d.emailPrincipal !== undefined) {
      await tx.contatoEmail.updateMany({ where: { clienteId: params.id, principal: true }, data: { principal: false } });
      if (d.emailPrincipal) {
        const existe = await tx.contatoEmail.findFirst({ where: { clienteId: params.id, email: d.emailPrincipal } });
        if (existe) await tx.contatoEmail.update({ where: { id: existe.id }, data: { principal: true } });
        else await tx.contatoEmail.create({ data: { clienteId: params.id, email: d.emailPrincipal, principal: true } });
      }
    }

    if (d.telefonePrincipal !== undefined) {
      await tx.contatoTelefone.updateMany({ where: { clienteId: params.id, principal: true }, data: { principal: false } });
      if (d.telefonePrincipal) {
        const existe = await tx.contatoTelefone.findFirst({ where: { clienteId: params.id, numero: d.telefonePrincipal } });
        if (existe) await tx.contatoTelefone.update({ where: { id: existe.id }, data: { principal: true, whatsapp: true } });
        else await tx.contatoTelefone.create({ data: { clienteId: params.id, numero: d.telefonePrincipal, principal: true, whatsapp: true } });
      }
    }
  });

  return NextResponse.json({ id: params.id });
}
