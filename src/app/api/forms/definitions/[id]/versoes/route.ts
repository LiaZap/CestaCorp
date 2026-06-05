import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { connectMongo } from "@/lib/db/mongo";
import { FormDefinitionModel } from "@/models/FormDefinition";
import { audit } from "@/lib/security/audit";

/**
 * Lista versões anteriores do formulário (#91).
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  await connectMongo();
  const doc: any = await FormDefinitionModel.findById(params.id).lean();
  if (!doc) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  return NextResponse.json({
    versaoAtual: doc.versao ?? 1,
    versoes: (doc.versoes ?? []).map((v: any) => ({
      versao: v.versao,
      salvoEm: v.salvoEm,
      salvoPor: v.salvoPor,
      qtdCampos: v.fields?.length ?? 0,
    })),
  });
}

/**
 * Restaura uma versão antiga — o snapshot vira o `fields` atual + versão
 * incrementa novamente (preserva o snapshot atual antes de sobrescrever).
 */
const RestaurarSchema = z.object({ versao: z.number().int().positive() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = RestaurarSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "versão inválida" }, { status: 400 });

  await connectMongo();
  const doc: any = await FormDefinitionModel.findById(params.id);
  if (!doc) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const alvo = (doc.versoes ?? []).find((v: any) => v.versao === parsed.data.versao);
  if (!alvo) return NextResponse.json({ error: "versão não existe" }, { status: 404 });

  // Salva atual como snapshot
  doc.versoes.push({
    versao: doc.versao ?? 1,
    fields: doc.fields,
    salvoEm: new Date(),
    salvoPor: (session.user as any).id ?? null,
  });
  if (doc.versoes.length > 20) doc.versoes.shift();

  doc.fields = alvo.fields;
  doc.versao = (doc.versao ?? 1) + 1;
  await doc.save();

  await audit({
    session, action: "form.restaurar-versao", resource: "form_definition",
    resourceId: params.id,
    after: { restaurada: parsed.data.versao, novaVersao: doc.versao },
    request: req,
  });

  return NextResponse.json({ ok: true, versao: doc.versao });
}
