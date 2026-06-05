import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";

const CreateSchema = z.object({
  titulo: z.string().min(2).max(120),
  texto: z.string().min(2).max(4000),
  canal: z.enum(["whatsapp", "email", "sms"]).default("whatsapp"),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const textos = await prisma.tagTexto.findMany({
    where: { tagId: params.id },
    orderBy: { titulo: "asc" },
  });
  return NextResponse.json(textos);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tag = await prisma.tag.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!tag) return NextResponse.json({ error: "tag não encontrada" }, { status: 404 });

  const texto = await prisma.tagTexto.create({
    data: { tagId: params.id, ...parsed.data },
  });

  await audit({
    session, action: "tagTexto.create", resource: "tag",
    resourceId: params.id, after: { tagTextoId: texto.id, titulo: texto.titulo },
    request: req,
  });

  return NextResponse.json(texto, { status: 201 });
}
