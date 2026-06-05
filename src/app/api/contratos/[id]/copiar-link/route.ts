import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { assertOwnership, AuthorizationError } from "@/lib/security/ownership";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

const Schema = z.object({
  /** Email do assinante específico. Se vazio, retorna o link geral do documento. */
  email: z.string().email().nullable().optional(),
});

/**
 * POST /api/contratos/[id]/copiar-link
 *
 * Retorna o link de assinatura do contrato. Se `email` for passado, retorna
 * o short_link específico daquele assinante (Autentique cria um por signatário).
 *
 * Não dispara nada — só lê o que foi gravado em assinaturaAssinantes/assinaturaUrl
 * pelo `enviarParaAssinatura`. Use isso pra copiar e mandar manualmente.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await assertOwnership(session, "contrato", params.id);
  } catch (err) {
    if (err instanceof AuthorizationError)
      return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = Schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const contrato = await prisma.contrato.findUnique({
    where: { id: params.id },
    select: {
      assinaturaUrl: true,
      assinaturaStatus: true,
      assinaturaAssinantes: true,
    },
  });
  if (!contrato)
    return NextResponse.json({ error: "contrato não encontrado" }, { status: 404 });

  if (!contrato.assinaturaUrl) {
    return NextResponse.json(
      {
        error:
          "contrato ainda não foi enviado pra assinatura — use 'Reenviar pra assinatura' primeiro",
      },
      { status: 400 },
    );
  }

  let url = contrato.assinaturaUrl;
  if (parsed.data.email) {
    const assinantes = Array.isArray(contrato.assinaturaAssinantes)
      ? (contrato.assinaturaAssinantes as any[])
      : [];
    const match = assinantes.find((a) => a?.email === parsed.data.email);
    if (match?.link) url = match.link;
  }

  await audit({
    session,
    action: "contrato.copiar-link",
    resource: "contrato",
    resourceId: params.id,
    after: { email: parsed.data.email ?? null },
    request: req,
  });

  return NextResponse.json({ ok: true, url, status: contrato.assinaturaStatus });
}
