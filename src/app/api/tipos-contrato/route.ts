import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { audit } from "@/lib/security/audit";

const Body = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, "use só letras minúsculas, números e -"),
  nome: z.string().min(2),
  descricao: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
  ordem: z.number().int().optional(),
  exigeOriginal: z.boolean().optional(),
});

export async function GET() {
  // Equipe lista pra cadastro; cliente do portal não precisa.
  const session = await auth();
  if (!session) return NextResponse.json([], { status: 401 });
  try { assertEquipe(session); }
  catch (e) { return NextResponse.json({ error: (e as AuthorizationError).message }, { status: 403 }); }

  const tipos = await prisma.tipoContrato.findMany({
    orderBy: [{ ativo: "desc" }, { ordem: "asc" }, { nome: "asc" }],
    include: { _count: { select: { templates: true } } },
  });
  return NextResponse.json(tipos);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); }
  catch (e) { return NextResponse.json({ error: (e as AuthorizationError).message }, { status: 403 }); }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const tipo = await prisma.tipoContrato.create({ data: parsed.data });
    await audit({
      session, action: "tipo-contrato.create", resource: "tipo_contrato",
      resourceId: tipo.id, after: { nome: tipo.nome, slug: tipo.slug }, request: req,
    });
    return NextResponse.json(tipo, { status: 201 });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Já existe um tipo com esse slug." }, { status: 409 });
    }
    throw e;
  }
}
