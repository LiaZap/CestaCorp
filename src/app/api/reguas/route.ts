import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { audit } from "@/lib/security/audit";

const PassoSchema = z.object({
  nome: z.string().min(1),
  offsetDias: z.number().int(),
  canal: z.enum(["WHATSAPP", "EMAIL", "SMS"]),
  templateMsg: z.string().min(1),
  horarioEnvio: z.string().default("09:00"),
  soDiasUteis: z.boolean().default(true),
});

const ReguaSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional(),
  ativa: z.boolean().default(true),
  passos: z.array(PassoSchema).min(1),
});

export async function GET() {
  // Equipe lê reguas; cliente do portal não precisa dessa visão administrativa.
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); }
  catch (e) { return NextResponse.json({ error: (e as AuthorizationError).message }, { status: 403 }); }

  const reguas = await prisma.reguaCobranca.findMany({
    include: { passos: { orderBy: { ordem: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(reguas);
}

export async function POST(req: NextRequest) {
  // Sem auth aqui era um bypass total — qualquer requisição criava régua.
  // Reportado em auditoria de seg #71.
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); }
  catch (e) { return NextResponse.json({ error: (e as AuthorizationError).message }, { status: 403 }); }

  const body = await req.json();
  const parsed = ReguaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { passos, ...rest } = parsed.data;
  const regua = await prisma.reguaCobranca.create({
    data: {
      ...rest,
      passos: {
        create: passos.map((p, i) => ({ ...p, ordem: i + 1 })),
      },
    },
    include: { passos: true },
  });

  await audit({
    session,
    action: "regua.create",
    resource: "regua",
    resourceId: regua.id,
    after: { nome: regua.nome, ativa: regua.ativa, passos: regua.passos.length },
    request: req,
  });

  return NextResponse.json(regua, { status: 201 });
}
