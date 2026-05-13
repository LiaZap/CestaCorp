import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

const Schema = z.object({
  nome: z.string().min(2),
  descricao: z.string().optional().nullable(),
  arquivoDocx: z.string().min(1),
  ordem: z.number().int().nonnegative().optional(),
  ativo: z.boolean().optional(),
  autoAplicarTags: z.array(z.string()).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const lista = await prisma.contratoAnexo.findMany({
    orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { nome: "asc" }],
  });
  return NextResponse.json(lista);
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
  const d = parsed.data;

  try {
    const anexo = await prisma.contratoAnexo.create({
      data: {
        nome: d.nome,
        descricao: d.descricao || null,
        arquivoDocx: d.arquivoDocx,
        ordem: d.ordem ?? 0,
        ativo: d.ativo ?? true,
        autoAplicarTags: d.autoAplicarTags ?? [],
      },
    });
    await audit({
      session, action: "contrato-anexo.create", resource: "contrato_anexo",
      resourceId: anexo.id, after: anexo, request: req,
    });
    return NextResponse.json(anexo, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "já existe anexo com esse nome" }, { status: 409 });
    }
    throw err;
  }
}
