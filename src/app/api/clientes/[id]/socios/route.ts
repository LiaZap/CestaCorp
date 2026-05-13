import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

const SocioSchema = z.object({
  nome: z.string().min(2),
  cpf: z.string().min(11),
  email: z.string().email().optional().or(z.literal("")),
  telefone: z.string().optional().nullable(),
  profissao: z.string().optional().nullable(),
  estadoCivil: z.string().optional().nullable(),
  quotas: z.number().nonnegative().optional().nullable(),
  representanteLegal: z.boolean().optional(),
  assinante: z.boolean().optional(),
  dataNascimento: z.string().optional().nullable(),  // ISO date
});

/** GET /api/clientes/[id]/socios — lista sócios do cliente */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const socios = await prisma.socio.findMany({
    where: { clienteId: params.id },
    orderBy: [{ representanteLegal: "desc" }, { nome: "asc" }],
  });
  return NextResponse.json(socios);
}

/** POST /api/clientes/[id]/socios — adiciona sócio ao cliente */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = SocioSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  const cliente = await prisma.cliente.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!cliente) return NextResponse.json({ error: "cliente não encontrado" }, { status: 404 });

  const socio = await prisma.socio.create({
    data: {
      clienteId: params.id,
      nome: d.nome,
      cpf: d.cpf,
      email: d.email || null,
      telefone: d.telefone || null,
      profissao: d.profissao || null,
      estadoCivil: d.estadoCivil || null,
      quotas: d.quotas ?? null,
      representanteLegal: d.representanteLegal ?? false,
      assinante: d.assinante ?? false,
      dataNascimento: d.dataNascimento ? new Date(d.dataNascimento) : null,
    },
  });

  await audit({
    session, action: "socio.create", resource: "cliente", resourceId: params.id,
    after: socio, request: req,
  });

  return NextResponse.json(socio, { status: 201 });
}
