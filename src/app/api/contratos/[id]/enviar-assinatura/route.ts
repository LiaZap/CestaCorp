import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { audit } from "@/lib/security/audit";
import { enviarParaAssinatura } from "@/lib/services/assinatura";

export const runtime = "nodejs";

const Schema = z.object({
  signers: z.array(z.object({
    nome: z.string().min(2),
    email: z.string().email(),
    cpf: z.string().optional(),
    telefone: z.string().optional(),
  })).min(1).max(10),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const contrato = await prisma.contrato.findUnique({ where: { id: params.id } });
  if (!contrato) return NextResponse.json({ error: "contrato não encontrado" }, { status: 404 });
  if (!contrato.docxPath && !contrato.pdfPath) {
    return NextResponse.json({ error: "contrato sem arquivo gerado" }, { status: 400 });
  }

  try {
    const result = await enviarParaAssinatura({
      contratoId: params.id,
      filePath: contrato.pdfPath ?? contrato.docxPath!,
      signers: parsed.data.signers,
    });
    await audit({
      session, action: "contrato.enviar-assinatura", resource: "contrato", resourceId: params.id,
      after: { provider: result.provider, docId: result.docId, signers: parsed.data.signers.length },
      request: req,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
