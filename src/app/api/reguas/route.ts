import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

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
  const reguas = await prisma.reguaCobranca.findMany({
    include: { passos: { orderBy: { ordem: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(reguas);
}

export async function POST(req: NextRequest) {
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
  return NextResponse.json(regua, { status: 201 });
}
