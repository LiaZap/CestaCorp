import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { connectMongo } from "@/lib/db/mongo";
import { FormDefinitionModel } from "@/models/FormDefinition";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

const FieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum([
    "text", "textarea", "email", "phone", "cpf", "cnpj",
    "date", "number", "money", "select", "multiselect",
    "radio", "checkbox", "file", "section",
  ]),
  required: z.boolean().optional(),
  helpText: z.string().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.object({
    label: z.string(),
    value: z.string(),
  })).optional(),
  validation: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    regex: z.string().optional(),
  }).optional(),
  mapping: z.object({
    entity: z.enum(["cliente", "socio", "contato", "endereco"]).optional(),
    field: z.string().optional(),
  }).optional(),
  showIf: z.object({
    field: z.string(),
    equals: z.any(),
  }).optional(),
});

const Schema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/i),
  title: z.string().min(2),
  description: z.string().optional(),
  category: z.enum([
    "abertura-empresa", "alteracao-empresa",
    "abertura-mei", "alteracao-mei",
    "socios", "carne-leao",
    "esocial-domestico", "gps-avulsa",
    "outros",
  ]),
  fields: z.array(FieldSchema).min(1, "adicione ao menos 1 campo"),
  active: z.boolean().optional(),
  autoFillFromClienteId: z.boolean().optional(),
  notifyEmails: z.array(z.string().email()).optional(),
});

/** GET — lista formulários (admin) */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  await connectMongo();
  const lista = await FormDefinitionModel.find().sort({ updatedAt: -1 }).lean();
  return NextResponse.json(lista);
}

/** POST — cria novo formulário */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await connectMongo();

  // Verifica slug único
  const existente = await FormDefinitionModel.findOne({ slug: parsed.data.slug.toLowerCase() }).lean();
  if (existente) {
    return NextResponse.json({ error: "slug já existe" }, { status: 409 });
  }

  const def = await FormDefinitionModel.create({
    ...parsed.data,
    slug: parsed.data.slug.toLowerCase(),
    active: parsed.data.active ?? true,
  });

  await audit({
    session, action: "form.create", resource: "form_definition",
    resourceId: String(def._id), after: parsed.data, request: req,
  });

  return NextResponse.json({ id: String(def._id), slug: def.slug }, { status: 201 });
}
