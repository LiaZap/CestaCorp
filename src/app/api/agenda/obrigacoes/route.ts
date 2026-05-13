import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

const ObrigacaoSchema = z.object({
  nome: z.string().min(1),
  tipo: z.enum([
    "DAS","DEFIS","DIRF","IRPF","ECF","ECD","FGTS","ESOCIAL","DCTF",
    "SPED_FISCAL","SPED_CONTRIBUICOES","REAJUSTE","REUNIAO","CERTIFICADO_DIGITAL","OUTROS",
  ]),
  descricao: z.string().optional(),
  recorrencia: z.enum(["MENSAL","ANUAL","TRIMESTRAL","SEMESTRAL","UNICA"]).default("MENSAL"),
  diaVencimento: z.number().int().min(1).max(31).optional().nullable(),
  mesVencimento: z.number().int().min(1).max(12).optional().nullable(),
  diaVencimentoAnual: z.number().int().min(1).max(31).optional().nullable(),
  dataUnica: z.string().optional().nullable(),
  antecedenciaDias: z.number().int().min(0).max(60).default(7),
  global: z.boolean().default(true),
  clienteId: z.string().optional().nullable(),
  categoriaCliente: z.enum(["BRONZE","PRATA","OURO","TOP"]).optional().nullable(),
  tributacaoFiltro: z.string().optional().nullable(),
  tagsRequeridas: z.array(z.string()).optional(),
  tagsExcluidas: z.array(z.string()).optional(),
  responsavel: z.string().optional(),
  ativa: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = ObrigacaoSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  const obrig = await prisma.obrigacao.create({
    data: {
      ...d,
      tagsRequeridas: d.tagsRequeridas ?? [],
      tagsExcluidas: d.tagsExcluidas ?? [],
      dataUnica: d.dataUnica ? new Date(d.dataUnica) : null,
    },
  });
  return NextResponse.json({ id: obrig.id }, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const list = await prisma.obrigacao.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json(list);
}
