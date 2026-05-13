import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { aplicarTodasRegrasTag } from "@/lib/services/regras-tag";
import { audit } from "@/lib/security/audit";

const Schema = z.object({
  tagId: z.string(),
  nome: z.string().min(2),
  descricao: z.string().optional(),
  condicao: z.enum([
    "COBRANCA_ATRASADA_DIAS", "PAGO_MESES_SEGUIDOS", "SEM_COBRANCA_ABERTA",
    "MES_ANIVERSARIO", "TRIBUTACAO_CONTAINS", "CLASSIFICACAO", "STATUS",
  ]),
  params: z.record(z.any()).optional(),
  acao: z.enum(["APLICAR", "REMOVER"]).default("APLICAR"),
  ativa: z.boolean().default(true),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const regras = await prisma.regraTag.findMany({
    orderBy: { createdAt: "desc" },
    include: { tag: { select: { nome: true, cor: true } } },
  });
  return NextResponse.json(regras);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const regra = await prisma.regraTag.create({ data: parsed.data });
  await audit({ session, action: "regra-tag.create", resource: "regra-tag", resourceId: regra.id, after: regra, request: req });
  return NextResponse.json(regra, { status: 201 });
}

/**
 * Executa TODAS as regras agora (on-demand, além do cron diário).
 */
export async function PUT() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const r = await aplicarTodasRegrasTag();
  return NextResponse.json({ ok: true, ...r });
}
