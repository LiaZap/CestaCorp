import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { isDocumentoValido } from "@/lib/security/documento";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

const Schema = z.object({
  cnpj: z.string().refine((s) => isDocumentoValido(s.replace(/\D/g, "")), {
    message: "CNPJ inválido",
  }),
  razaoSocial: z.string().min(2),
  nomeFantasia: z.string().optional(),
});

/**
 * POST /api/pre-cadastros/[id]/virar-cliente
 *
 * Converte um PreCadastro em Cliente quando a empresa é aberta na Receita.
 * Mantém o código sequencial reservado (não gera um novo).
 * Importa todos os dados conhecidos do pré-cadastro pro Cliente.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { cnpj, razaoSocial, nomeFantasia } = parsed.data;

  const pre = await prisma.preCadastro.findUnique({ where: { id: params.id } });
  if (!pre) return NextResponse.json({ error: "pré-cadastro não encontrado" }, { status: 404 });
  if (pre.status === "VIROU_CLIENTE" && pre.clienteId) {
    return NextResponse.json(
      { error: "este pré-cadastro já virou cliente", clienteId: pre.clienteId },
      { status: 409 }
    );
  }

  // Formata CPF/CNPJ
  const cnpjLimpo = cnpj.replace(/\D/g, "");
  const cnpjFormatado = cnpjLimpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");

  // Verifica se já existe cliente com esse CNPJ
  const existente = await prisma.cliente.findUnique({ where: { cpfCnpj: cnpjFormatado } });
  if (existente) {
    return NextResponse.json(
      { error: `já existe cliente com CNPJ ${cnpjFormatado}`, clienteId: existente.id },
      { status: 409 }
    );
  }

  // Cria cliente preservando código do pré-cadastro
  const cliente = await prisma.cliente.create({
    data: {
      codigo: pre.codigo,
      razaoSocial,
      nomeFantasia: nomeFantasia ?? pre.nomeEmpresaPretendido ?? null,
      cpfCnpj: cnpjFormatado,
      tipoPessoa: "JURIDICA",
      tributacao: pre.regimePretendido,
      status: "ATIVO",
      respFiscal: pre.responsavelComercial ?? null,
      indiceReajuste: "IPCA",
      // Cria email + telefone do contato
      emails: pre.emailContato
        ? { create: [{ email: pre.emailContato, principal: true, tipo: "principal" }] }
        : undefined,
      telefones: pre.telefoneContato
        ? { create: [{ numero: pre.telefoneContato.replace(/\D/g, ""), principal: true, whatsapp: true }] }
        : undefined,
      // Cria sócio com base no contato (assinante)
      socios: pre.cpfContato
        ? {
            create: [{
              nome: pre.nomeContato,
              cpf: pre.cpfContato,
              email: pre.emailContato,
              telefone: pre.telefoneContato,
              representanteLegal: true,
              assinante: true,
            }],
          }
        : undefined,
    },
  });

  // Atualiza pré-cadastro como VIROU_CLIENTE
  const preAtualizado = await prisma.preCadastro.update({
    where: { id: params.id },
    data: {
      status: "VIROU_CLIENTE",
      cnpj: cnpjLimpo,
      clienteId: cliente.id,
    },
  });

  await audit({
    session,
    action: "pre-cadastro.virar-cliente",
    resource: "pre_cadastro",
    resourceId: params.id,
    before: pre, after: preAtualizado,
    request: req,
  });

  return NextResponse.json({
    ok: true,
    clienteId: cliente.id,
    codigo: cliente.codigo,
    razaoSocial: cliente.razaoSocial,
  });
}
