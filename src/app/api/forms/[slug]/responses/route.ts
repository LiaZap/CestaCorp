import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectMongo } from "@/lib/db/mongo";
import { FormDefinitionModel } from "@/models/FormDefinition";
import { FormResponseModel } from "@/models/FormResponse";
import { notificar } from "@/lib/services/notifications";
import { rateLimit } from "@/lib/security/rate-limit";
import { isCpfValido, isCnpjValido, soDigitos } from "@/lib/security/documento";

const AutorSchema = z.object({
  nome: z.string().min(2, "Informe seu nome").max(200),
  email: z.string().email("E-mail inválido"),
  telefone: z.string().optional(),
});

const BodySchema = z.object({
  answers: z.record(z.any()),
  autor: AutorSchema,
  clienteId: z.string().optional(),
  // Quando o form é aberto pelo link enviado no e-mail de boas-vindas (#79),
  // o `?pre=<id>` é preservado pra associar a resposta ao pré-cadastro.
  preCadastroId: z.string().optional(),
});

/**
 * Validação dinâmica das respostas contra os fields definidos no FormDefinition.
 * Cada field tem type (text, email, cpf, cnpj, date, number, money, checkbox, select, file, textarea)
 * + flag required. Retorna lista de { field, message } em caso de erro.
 */
function validarRespostas(fields: any[], answers: Record<string, any>): { field: string; message: string }[] {
  const erros: { field: string; message: string }[] = [];

  for (const f of fields ?? []) {
    if (f.type === "section") continue;
    // Respeitar showIf — se a condição não bater, pula
    if (f.showIf && f.showIf.field) {
      const val = answers[f.showIf.field];
      if (val !== f.showIf.equals) continue;
    }

    const v = answers[f.key];
    const preenchido = v !== undefined && v !== null && v !== "";

    if (f.required && !preenchido) {
      erros.push({ field: f.key, message: `Campo "${f.label}" é obrigatório` });
      continue;
    }
    if (!preenchido) continue;

    const s = String(v);
    switch (f.type) {
      case "email":
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s))
          erros.push({ field: f.key, message: `"${f.label}": e-mail inválido` });
        break;
      case "cpf":
        if (!isCpfValido(soDigitos(s)))
          erros.push({ field: f.key, message: `"${f.label}": CPF inválido` });
        break;
      case "cnpj":
        if (!isCnpjValido(soDigitos(s)))
          erros.push({ field: f.key, message: `"${f.label}": CNPJ inválido` });
        break;
      case "date":
        if (isNaN(Date.parse(s)))
          erros.push({ field: f.key, message: `"${f.label}": data inválida` });
        break;
      case "number":
      case "money": {
        const n = Number(s);
        if (!Number.isFinite(n))
          erros.push({ field: f.key, message: `"${f.label}": número inválido` });
        else {
          if (f.validation?.min !== undefined && n < f.validation.min)
            erros.push({ field: f.key, message: `"${f.label}": valor mínimo ${f.validation.min}` });
          if (f.validation?.max !== undefined && n > f.validation.max)
            erros.push({ field: f.key, message: `"${f.label}": valor máximo ${f.validation.max}` });
        }
        break;
      }
      case "select":
      case "radio":
        if (f.options && !f.options.some((o: any) => o.value === s))
          erros.push({ field: f.key, message: `"${f.label}": opção inválida` });
        break;
      case "file":
        if (typeof v !== "object" || !v?.url)
          erros.push({ field: f.key, message: `"${f.label}": envie um arquivo válido` });
        break;
      case "text":
      case "textarea":
      case "phone": {
        if (f.validation?.minLength && s.length < f.validation.minLength)
          erros.push({ field: f.key, message: `"${f.label}": mínimo ${f.validation.minLength} caracteres` });
        if (f.validation?.maxLength && s.length > f.validation.maxLength)
          erros.push({ field: f.key, message: `"${f.label}": máximo ${f.validation.maxLength} caracteres` });
        if (f.validation?.regex && !(new RegExp(f.validation.regex)).test(s))
          erros.push({ field: f.key, message: `"${f.label}": formato inválido` });
        break;
      }
    }
  }

  return erros;
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  // Rate limit contra spam de formulário: 10 submits por IP a cada 15min
  const rl = rateLimit(req, `form-${params.slug}`, { max: 10, windowMs: 15 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "muitas submissões — aguarde alguns minutos" },
      { status: 429, headers: rl.headers }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "payload inválido" }, { status: 400, headers: rl.headers });

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400, headers: rl.headers });
  }

  await connectMongo();
  const form = await FormDefinitionModel.findOne({ slug: params.slug, active: true });
  if (!form) return NextResponse.json({ error: "Formulário não encontrado" }, { status: 404, headers: rl.headers });

  // Validação dinâmica server-side contra a definição do form
  const errosCampos = validarRespostas((form as any).fields ?? [], parsed.data.answers);
  if (errosCampos.length > 0) {
    return NextResponse.json({ error: "Validação falhou", campos: errosCampos }, { status: 400, headers: rl.headers });
  }

  const response = await FormResponseModel.create({
    formSlug: params.slug,
    formId: form._id,
    clienteId: parsed.data.clienteId,
    preCadastroId: parsed.data.preCadastroId,
    autor: parsed.data.autor,
    answers: parsed.data.answers,
    ip: req.headers.get("x-forwarded-for") || undefined,
    userAgent: req.headers.get("user-agent") || undefined,
  });

  await notificar({
    tipo: "FORM_RECEBIDO",
    titulo: `Novo formulário: ${form.title}`,
    descricao: `De ${parsed.data.autor.nome} (${parsed.data.autor.email})`,
    href: `/formularios/${response._id}`,
    priority: "NORMAL",
  });

  return NextResponse.json({ ok: true, id: response._id }, { status: 201, headers: rl.headers });
}
