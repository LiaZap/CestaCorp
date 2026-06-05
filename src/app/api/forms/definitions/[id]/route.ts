import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { connectMongo } from "@/lib/db/mongo";
import { FormDefinitionModel } from "@/models/FormDefinition";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

const PatchSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  fields: z.array(z.any()).optional(),
  active: z.boolean().optional(),
  autoFillFromClienteId: z.boolean().optional(),
  notifyEmails: z.array(z.string().email()).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  await connectMongo();
  const def = await FormDefinitionModel.findById(params.id).lean();
  if (!def) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json(def);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await connectMongo();
  const before: any = await FormDefinitionModel.findById(params.id).lean();
  if (!before) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  // Versionamento (#91): se fields mudou, salva snapshot da versão anterior
  // antes de aplicar o patch. Mantém últimas 20 revisões.
  const fieldsmudaram = parsed.data.fields !== undefined
    && JSON.stringify(parsed.data.fields) !== JSON.stringify(before.fields);

  const ops: any = { $set: parsed.data };
  if (fieldsmudaram) {
    const versaoAtual = (before.versao ?? 1);
    const snapshot = {
      versao: versaoAtual,
      fields: before.fields ?? [],
      salvoEm: new Date(),
      salvoPor: (session.user as any).id ?? null,
    };
    ops.$set = { ...ops.$set, versao: versaoAtual + 1 };
    ops.$push = { versoes: { $each: [snapshot], $slice: -20 } };
  }

  const updated = await FormDefinitionModel.findByIdAndUpdate(
    params.id, ops, { new: true }
  ).lean();

  await audit({
    session, action: "form.update", resource: "form_definition",
    resourceId: params.id, before, after: updated, request: req,
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  await connectMongo();
  await FormDefinitionModel.findByIdAndDelete(params.id);

  await audit({
    session, action: "form.delete", resource: "form_definition",
    resourceId: params.id, request: req,
  });

  return NextResponse.json({ ok: true });
}
