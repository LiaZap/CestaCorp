import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adicionarObservacao } from "@/lib/services/cliente-timeline";

const BodySchema = z.object({ conteudo: z.string().min(1).max(1000) });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const autor = session.user?.name || session.user?.email || "equipe";
  const obs = await adicionarObservacao(params.id, autor, parsed.data.conteudo);
  return NextResponse.json({ ok: true, id: obs.id }, { status: 201 });
}
