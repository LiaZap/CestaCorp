import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

const Schema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/i, "slug deve ter só letras, números e hífen"),
  nome: z.string().min(2),
  descricao: z.string().optional().nullable(),
  tipo: z.enum(["fixo", "tabela"]),
  valorFixo: z.number().optional().nullable(),
  valoresMensais: z.array(z.object({
    ano: z.number().int(),
    mes: z.number().int().min(1).max(12),
    valor: z.number(),
  })).optional(),
  fonte: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  const lista = await prisma.indiceCustomizado.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
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

  if (d.tipo === "fixo" && (d.valorFixo === null || d.valorFixo === undefined)) {
    return NextResponse.json({ error: "tipo 'fixo' precisa de valorFixo" }, { status: 400 });
  }

  try {
    const indice = await prisma.indiceCustomizado.create({
      data: {
        slug: d.slug.toLowerCase(),
        nome: d.nome,
        descricao: d.descricao || null,
        tipo: d.tipo,
        valorFixo: d.valorFixo ?? null,
        valoresMensais: d.valoresMensais ?? [],
        fonte: d.fonte || null,
        ativo: d.ativo ?? true,
      },
    });
    await audit({
      session, action: "indice.create", resource: "indice_customizado",
      resourceId: indice.id, after: indice, request: req,
    });
    return NextResponse.json(indice, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ error: "já existe índice com esse slug" }, { status: 409 });
    }
    throw err;
  }
}
