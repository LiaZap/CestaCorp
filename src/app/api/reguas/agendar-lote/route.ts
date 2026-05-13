import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectMongo } from "@/lib/db/mongo";
import { EnvioAgendadoModel } from "@/models/EnvioAgendado";

const Schema = z.object({
  titulo: z.string().optional(),
  agendadoPara: z.string(), // ISO
  template: z.string().min(1),
  canal: z.enum(["WHATSAPP", "EMAIL"]).default("WHATSAPP"),
  alvos: z.array(z.object({
    clienteId: z.string(),
    cobrancaId: z.string().optional(),
    razaoSocial: z.string(),
    telefone: z.string().optional(),
  })).min(1),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await connectMongo();
  const doc = await EnvioAgendadoModel.create({
    ...parsed.data,
    agendadoPara: new Date(parsed.data.agendadoPara),
    criadoPor: (session.user as any).id,
  });

  return NextResponse.json({ ok: true, id: doc._id });
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectMongo();
  const lista = await EnvioAgendadoModel.find({})
    .sort({ agendadoPara: 1 })
    .limit(50)
    .lean();
  return NextResponse.json(lista);
}
