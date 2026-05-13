import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";

const PassoSchema = z.object({
  id: z.string().optional(),
  nome: z.string().min(1),
  offsetDias: z.number().int(),
  canal: z.enum(["WHATSAPP", "EMAIL", "SMS"]),
  templateMsg: z.string().min(1),
  horarioEnvio: z.string().default("09:00"),
  soDiasUteis: z.boolean().default(true),
});

const ReguaSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional().nullable(),
  ativa: z.boolean().default(true),
  passos: z.array(PassoSchema).min(1),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const regua = await prisma.reguaCobranca.findUnique({
    where: { id: params.id },
    include: { passos: { orderBy: { ordem: "asc" } } },
  });
  if (!regua) return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  return NextResponse.json(regua);
}

/**
 * Atualiza a régua inteira: atualiza/cria/remove passos para casar com a lista enviada.
 * Passos novos recebem ordem incremental; ordem é reescrita a cada PUT.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = ReguaSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  const atual = await prisma.reguaCobranca.findUnique({
    where: { id: params.id },
    include: { passos: true },
  });
  if (!atual) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  const idsEnviados = new Set(d.passos.map((p) => p.id).filter(Boolean) as string[]);
  const idsParaRemover = atual.passos.filter((p) => !idsEnviados.has(p.id)).map((p) => p.id);

  await prisma.$transaction(async (tx) => {
    await tx.reguaCobranca.update({
      where: { id: params.id },
      data: { nome: d.nome, descricao: d.descricao ?? null, ativa: d.ativa },
    });

    // passos removidos → se já tiverem execuções vinculadas, preservar (ORM barra delete por FK)
    if (idsParaRemover.length) {
      const comExecucao = await tx.execucaoRegua.findMany({
        where: { passoId: { in: idsParaRemover } },
        select: { passoId: true },
      });
      const bloqueados = new Set(comExecucao.map((e) => e.passoId));
      const removerOk = idsParaRemover.filter((id) => !bloqueados.has(id));
      if (removerOk.length) {
        await tx.reguaPasso.deleteMany({ where: { id: { in: removerOk } } });
      }
    }

    // upsert com nova ordem
    for (let i = 0; i < d.passos.length; i++) {
      const p = d.passos[i];
      const dados = {
        reguaId: params.id,
        ordem: i + 1,
        nome: p.nome,
        offsetDias: p.offsetDias,
        canal: p.canal,
        templateMsg: p.templateMsg,
        horarioEnvio: p.horarioEnvio,
        soDiasUteis: p.soDiasUteis,
      };
      if (p.id) {
        await tx.reguaPasso.update({ where: { id: p.id }, data: dados });
      } else {
        await tx.reguaPasso.create({ data: dados });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const temExecucao = await prisma.execucaoRegua.count({ where: { reguaId: params.id } });
  if (temExecucao > 0) {
    await prisma.reguaCobranca.update({ where: { id: params.id }, data: { ativa: false } });
    return NextResponse.json({ ok: true, soft: true, motivo: "régua com histórico — marcada como inativa" });
  }
  await prisma.reguaCobranca.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
