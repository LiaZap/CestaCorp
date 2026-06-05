import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { isDocumentoValido } from "@/lib/security/documento";
import { audit } from "@/lib/security/audit";

const ClienteSchema = z.object({
  codigo: z.number().int().positive().optional().nullable(),
  razaoSocial: z.string().min(2),
  nomeFantasia: z.string().optional().nullable(),
  cpfCnpj: z.string().min(11).refine(isDocumentoValido, {
    message: "CPF/CNPJ inválido (dígitos verificadores não conferem)",
  }),
  tipoPessoa: z.enum(["FISICA", "JURIDICA", "MEI"]).optional(),
  classificacao: z.enum(["BRONZE", "PRATA", "OURO", "DIAMANTE", "TOP"]).optional().nullable(),
  status: z.enum(["ATIVO", "INATIVO", "ENCERRADO", "PROSPECT", "SUSPENSO"]).optional(),
  mesAniversarioReajuste: z.number().int().min(1).max(12).optional().nullable(),
  indiceReajuste: z.enum(["IPCA", "IGPM", "INPC", "FIXO", "CUSTOM"]).optional().nullable(),
  respFiscal: z.string().optional().nullable(),
  respFolha: z.string().optional().nullable(),
  respContabil: z.string().optional().nullable(),
  tributacao: z.string().optional().nullable(),
  prefeitura: z.string().optional().nullable(),
  dataConstituicao: z.string().optional().nullable(),    // ISO
  whatsappGrupoId: z.string().optional().nullable(),
  whatsappGrupoNome: z.string().optional().nullable(),
  emailPrincipal: z.string().email().optional().or(z.literal("")),
  telefonePrincipal: z.string().optional(),
  niboCustomerId: z.string().optional().nullable(),
  digisacContactId: z.string().optional().nullable(),
  // Endereço estruturado (#27)
  enderecoLogradouro: z.string().optional().nullable(),
  enderecoNumero: z.string().optional().nullable(),
  enderecoComplemento: z.string().optional().nullable(),
  enderecoBairro: z.string().optional().nullable(),
  enderecoMunicipio: z.string().optional().nullable(),
  enderecoUf: z.string().max(2).optional().nullable(),
  enderecoCep: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = ClienteSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  // Se não passar código, gera o próximo automaticamente
  let codigo = d.codigo ?? null;
  if (!codigo) {
    const ultimo = await prisma.cliente.aggregate({ _max: { codigo: true } });
    codigo = (ultimo._max.codigo ?? 0) + 1;
  }

  // Verifica colisão de código
  if (codigo) {
    const colide = await prisma.cliente.findUnique({ where: { codigo }, select: { id: true } });
    if (colide) {
      return NextResponse.json(
        { error: `código ${codigo} já está em uso por outro cliente` },
        { status: 409 }
      );
    }
  }

  try {
    const cliente = await prisma.cliente.create({
      data: {
        codigo,
        razaoSocial: d.razaoSocial,
        nomeFantasia: d.nomeFantasia || null,
        cpfCnpj: d.cpfCnpj,
        tipoPessoa: d.tipoPessoa ?? "JURIDICA",
        classificacao: d.classificacao ?? null,
        status: d.status ?? "ATIVO",
        mesAniversarioReajuste: d.mesAniversarioReajuste ?? null,
        indiceReajuste: d.indiceReajuste ?? "IPCA",
        respFiscal: d.respFiscal || null,
        respFolha: d.respFolha || null,
        respContabil: d.respContabil || null,
        tributacao: d.tributacao || null,
        prefeitura: d.prefeitura || null,
        dataConstituicao: d.dataConstituicao ? new Date(d.dataConstituicao) : null,
        whatsappGrupoId: d.whatsappGrupoId || null,
        whatsappGrupoNome: d.whatsappGrupoNome || null,
        niboCustomerId: d.niboCustomerId || null,
        digisacContactId: d.digisacContactId || null,
        // Endereço estruturado (#27)
        enderecoLogradouro: d.enderecoLogradouro || null,
        enderecoNumero: d.enderecoNumero || null,
        enderecoComplemento: d.enderecoComplemento || null,
        enderecoBairro: d.enderecoBairro || null,
        enderecoMunicipio: d.enderecoMunicipio || null,
        enderecoUf: d.enderecoUf ? d.enderecoUf.toUpperCase() : null,
        enderecoCep: d.enderecoCep || null,
        emails: d.emailPrincipal ? { create: [{ email: d.emailPrincipal, principal: true }] } : undefined,
        telefones: d.telefonePrincipal ? { create: [{ numero: d.telefonePrincipal, principal: true, whatsapp: true }] } : undefined,
      },
    });

    await audit({ session, action: "cliente.create", resource: "cliente", resourceId: cliente.id, after: cliente, request: req });

    return NextResponse.json({ id: cliente.id, codigo: cliente.codigo }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "CPF/CNPJ ou código já cadastrado" },
        { status: 409 }
      );
    }
    throw err;
  }
}

