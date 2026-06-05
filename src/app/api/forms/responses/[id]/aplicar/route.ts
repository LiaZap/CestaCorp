import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/db/mongo";
import { FormResponseModel } from "@/models/FormResponse";
import { FormDefinitionModel } from "@/models/FormDefinition";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { notificar } from "@/lib/services/notifications";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { isDocumentoValido, soDigitos, formatarDocumento } from "@/lib/security/documento";
import { audit } from "@/lib/security/audit";

/**
 * Aplica uma resposta de formulário ao cadastro.
 *
 * 4 modos (#88 + #89):
 *   - "criar":              cria/atualiza Cliente via upsert por CPF/CNPJ (legado)
 *   - "vincular-cliente":   atualiza Cliente existente identificado por clienteId
 *                           (sócios e contatos adicionados, campos preenchidos só se vazios)
 *   - "vincular-precadastro": atualiza PreCadastro existente identificado por preCadastroId
 *   - "criar-precadastro":  cria PreCadastro novo a partir dos dados (sem upsert)
 *
 * Sempre retorna JSON com next: URL pra redirecionar no cliente.
 * Nunca lança 500 — erros vão em `error` no payload.
 */

const Schema = z.object({
  modo: z.enum(["criar", "vincular-cliente", "vincular-precadastro", "criar-precadastro"]),
  clienteId: z.string().optional(),
  preCadastroId: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  let modo: "criar" | "vincular-cliente" | "vincular-precadastro" | "criar-precadastro" = "criar";
  let clienteId: string | undefined;
  let preCadastroId: string | undefined;

  // Aceita JSON moderno OU form-encoded legado (botão sem JS)
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      const parsed = Schema.safeParse(await req.json());
      if (!parsed.success) {
        return NextResponse.json({ error: "modo inválido", detalhes: parsed.error.flatten() }, { status: 400 });
      }
      modo = parsed.data.modo;
      clienteId = parsed.data.clienteId;
      preCadastroId = parsed.data.preCadastroId;
    }
  } catch {
    // fallback silencioso → modo "criar"
  }

  await connectMongo();
  const resposta: any = await FormResponseModel.findById(params.id).lean();
  if (!resposta) return NextResponse.json({ error: "resposta não encontrada" }, { status: 404 });
  const form: any = await FormDefinitionModel.findOne({ slug: resposta.formSlug }).lean();
  if (!form) return NextResponse.json({ error: "formulário não encontrado" }, { status: 404 });

  // Mapeia respostas → buckets
  const clienteData: Record<string, any> = {};
  const socioData: Record<string, any> = {};
  for (const f of form.fields ?? []) {
    if (!f.mapping) continue;
    const value = resposta.answers?.[f.key];
    if (value == null || value === "") continue;
    if (f.mapping.entity === "cliente") clienteData[f.mapping.field] = value;
    else if (f.mapping.entity === "socio") socioData[f.mapping.field] = value;
  }

  // ─── MODO: vincular a CLIENTE existente ───────────────────────
  if (modo === "vincular-cliente") {
    if (!clienteId) {
      return NextResponse.json({ error: "Selecione um cliente para vincular" }, { status: 400 });
    }
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

    // Atualiza só campos vazios — preserva o que já está cadastrado
    const patch: Record<string, any> = {};
    if (clienteData.razaoSocial && !cliente.razaoSocial) patch.razaoSocial = clienteData.razaoSocial;
    if (clienteData.nomeFantasia && !cliente.nomeFantasia) patch.nomeFantasia = clienteData.nomeFantasia;
    if (clienteData.enderecoLogradouro && !cliente.enderecoLogradouro) patch.enderecoLogradouro = clienteData.enderecoLogradouro;
    if (clienteData.enderecoNumero && !cliente.enderecoNumero) patch.enderecoNumero = clienteData.enderecoNumero;
    if (clienteData.enderecoComplemento && !cliente.enderecoComplemento) patch.enderecoComplemento = clienteData.enderecoComplemento;
    if (clienteData.enderecoBairro && !cliente.enderecoBairro) patch.enderecoBairro = clienteData.enderecoBairro;
    if (clienteData.enderecoMunicipio && !cliente.enderecoMunicipio) patch.enderecoMunicipio = clienteData.enderecoMunicipio;
    if (clienteData.enderecoUf && !cliente.enderecoUf) patch.enderecoUf = String(clienteData.enderecoUf).slice(0, 2).toUpperCase();
    if (clienteData.enderecoCep && !cliente.enderecoCep) patch.enderecoCep = clienteData.enderecoCep;

    if (Object.keys(patch).length > 0) {
      await prisma.cliente.update({ where: { id: cliente.id }, data: patch });
    }

    await criarSocioSeHouver(cliente.id, socioData);

    await FormResponseModel.updateOne(
      { _id: params.id },
      { $set: { status: "APLICADO", aplicadoEm: new Date(), aplicadoPor: (session.user as any).id, clienteId: cliente.id, vinculoModo: "cliente" } }
    );

    await audit({
      session, action: "form-response.aplicar.vincular-cliente", resource: "cliente",
      resourceId: cliente.id, after: { respostaId: params.id, camposAtualizados: Object.keys(patch) },
      request: req,
    });

    return NextResponse.json({ ok: true, modo, next: `/clientes/${cliente.id}` });
  }

  // ─── MODO: vincular a PRÉ-CADASTRO existente ───────────────────
  if (modo === "vincular-precadastro") {
    if (!preCadastroId) {
      return NextResponse.json({ error: "Selecione um pré-cadastro para vincular" }, { status: 400 });
    }
    const pre = await prisma.preCadastro.findUnique({ where: { id: preCadastroId } });
    if (!pre) return NextResponse.json({ error: "Pré-cadastro não encontrado" }, { status: 404 });

    const patch: Record<string, any> = {};
    if (clienteData.razaoSocial && !pre.nomeEmpresaPretendido) patch.nomeEmpresaPretendido = clienteData.razaoSocial;
    if (clienteData.cpfCnpj) {
      const d = soDigitos(String(clienteData.cpfCnpj));
      if (isDocumentoValido(d)) {
        if (d.length === 14 && !pre.cnpj) patch.cnpj = formatarDocumento(d);
        else if (d.length === 11 && !pre.cpfContato) patch.cpfContato = formatarDocumento(d);
      }
    }
    if (Object.keys(patch).length > 0) {
      await prisma.preCadastro.update({ where: { id: pre.id }, data: patch });
    }

    await FormResponseModel.updateOne(
      { _id: params.id },
      { $set: { status: "APLICADO", aplicadoEm: new Date(), aplicadoPor: (session.user as any).id, preCadastroId: pre.id, vinculoModo: "precadastro" } }
    );

    await audit({
      session, action: "form-response.aplicar.vincular-precadastro", resource: "preCadastro",
      resourceId: pre.id, after: { respostaId: params.id, camposAtualizados: Object.keys(patch) },
      request: req,
    });

    return NextResponse.json({ ok: true, modo, next: `/clientes/pre-cadastros/${pre.id}` });
  }

  // ─── MODO: criar PRÉ-CADASTRO novo ─────────────────────────────
  if (modo === "criar-precadastro") {
    const nome = resposta.autor?.nome || clienteData.razaoSocial || "(sem nome)";
    const email = resposta.autor?.email || "";
    if (!email.includes("@")) {
      return NextResponse.json({ error: "Pré-cadastro precisa de e-mail do contato" }, { status: 400 });
    }
    const pre = await prisma.preCadastro.create({
      data: {
        nomeContato: nome,
        emailContato: email.toLowerCase(),
        telefoneContato: resposta.autor?.telefone || null,
        cpfContato: clienteData.cpfCnpj ? formatarDocumento(soDigitos(String(clienteData.cpfCnpj))) : null,
        nomeEmpresaPretendido: clienteData.razaoSocial || null,
        criadoPor: (session.user as any).id ?? null,
        status: "PENDENTE",
      },
    });

    await FormResponseModel.updateOne(
      { _id: params.id },
      { $set: { status: "APLICADO", aplicadoEm: new Date(), aplicadoPor: (session.user as any).id, preCadastroId: pre.id, vinculoModo: "precadastro" } }
    );

    await audit({
      session, action: "form-response.aplicar.criar-precadastro", resource: "preCadastro",
      resourceId: pre.id, after: { respostaId: params.id },
      request: req,
    });

    return NextResponse.json({ ok: true, modo, next: `/clientes/pre-cadastros/${pre.id}` });
  }

  // ─── MODO: criar Cliente (fluxo legado por CPF/CNPJ) ───────────
  const docRaw = soDigitos(String(clienteData.cpfCnpj ?? socioData.cpf ?? ""));
  if (!docRaw) {
    return NextResponse.json({
      error: "Sem CPF/CNPJ no formulário pra criar cliente. Use 'Vincular a cliente existente' ou 'Criar pré-cadastro'.",
    }, { status: 400 });
  }
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

  await criarSocioSeHouver(cliente.id, socioData);

  await FormResponseModel.updateOne(
    { _id: params.id },
    { $set: { status: "APLICADO", aplicadoEm: new Date(), aplicadoPor: (session.user as any).id, clienteId: cliente.id, vinculoModo: "criar" } }
  );

  if (cliente.status === "PROSPECT") {
    await notificar({
      tipo: "CLIENTE_PROSPECT",
      titulo: `Novo prospect: ${cliente.razaoSocial}`,
      descricao: `Criado a partir do formulário ${resposta.formSlug}`,
      href: `/clientes/${cliente.id}`,
      clienteId: cliente.id,
    });
  }

  await audit({
    session, action: "form-response.aplicar.criar-cliente", resource: "cliente",
    resourceId: cliente.id, after: { respostaId: params.id },
    request: req,
  });

  return NextResponse.json({ ok: true, modo: "criar", next: `/clientes/${cliente.id}` });
}

async function criarSocioSeHouver(clienteId: string, socioData: Record<string, any>) {
  if (!socioData.nome || !socioData.cpf) return;
  const cpfRaw = soDigitos(String(socioData.cpf));
  if (!isDocumentoValido(cpfRaw)) return;
  const cpfFmt = formatarDocumento(cpfRaw);
  const existe = await prisma.socio.findFirst({ where: { clienteId, cpf: cpfFmt } });
  if (existe) return;
  await prisma.socio.create({
    data: {
      clienteId,
      nome: String(socioData.nome),
      cpf: cpfFmt,
      profissao: socioData.profissao ? String(socioData.profissao) : undefined,
    },
  });
}
