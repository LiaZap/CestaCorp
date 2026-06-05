import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { connectMongo } from "@/lib/db/mongo";
import { FormDefinitionModel } from "@/models/FormDefinition";
import { audit } from "@/lib/security/audit";

/**
 * Duplica um formulário inteiro com novo slug auto-incrementado.
 * #91: Patrick (reunião 05/06 17:17) "queria importar um formulário existente
 * pra editar partindo dele". Caso de uso: criar variante de "Dados de Sócio"
 * pra "Dados de Sócio Cônjuge".
 *
 * Histórico de versões (`versoes`) NÃO é copiado — começa do zero na nova def.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  await connectMongo();
  const origem: any = await FormDefinitionModel.findById(params.id).lean();
  if (!origem) return NextResponse.json({ error: "origem não encontrada" }, { status: 404 });

  // Próximo slug livre: original-copia, original-copia-2, etc.
  const baseSlug = `${origem.slug}-copia`;
  let novoSlug = baseSlug;
  let n = 1;
  while (await FormDefinitionModel.findOne({ slug: novoSlug }).lean()) {
    n++;
    novoSlug = `${baseSlug}-${n}`;
  }

  const novo = await FormDefinitionModel.create({
    slug: novoSlug,
    title: `${origem.title} (cópia)`,
    description: origem.description,
    category: origem.category,
    fields: origem.fields, // copia fields completos
    active: false,         // começa inativo pra não publicar acidentalmente
    autoFillFromClienteId: origem.autoFillFromClienteId,
    notifyEmails: origem.notifyEmails,
    versao: 1,
    versoes: [],
  });

  await audit({
    session, action: "form.duplicar", resource: "form_definition",
    resourceId: String(novo._id),
    after: { origem: params.id, novoSlug },
    request: req,
  });

  return NextResponse.json({ id: String(novo._id), slug: novoSlug }, { status: 201 });
}
