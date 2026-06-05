import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { audit } from "@/lib/security/audit";
import { enviarMensagem as digisacEnviarMensagem } from "@/lib/services/digisac";

export const runtime = "nodejs";

const Schema = z.object({
  /** Lista de emails dos assinantes pra reenviar. Se vazio, manda pro telefone WhatsApp do cliente. */
  destinatarios: z.array(z.string()).optional(),
  /** Mensagem custom. Default: texto padrão com link de assinatura. */
  mensagem: z.string().max(2000).optional(),
});

/**
 * POST /api/contratos/[id]/enviar-whatsapp
 *
 * Reenvia o link de assinatura via Digisac (WhatsApp).
 * Para cada assinante selecionado, manda DM se houver telefone cadastrado no sócio.
 * Se nenhum destinatário casa, manda pro telefone do cliente (whatsapp=true).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    assertEquipe(session);
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
    include: {
      cliente: {
        select: {
          id: true,
          razaoSocial: true,
          telefones: { where: { whatsapp: true, deletedAt: null }, take: 5 },
          socios: { where: { telefone: { not: null } } },
        },
      },
    },
  });
  if (!contrato)
    return NextResponse.json({ error: "contrato não encontrado" }, { status: 404 });
  if (!contrato.assinaturaUrl) {
    return NextResponse.json(
      { error: "contrato ainda não enviado pra assinatura" },
      { status: 400 },
    );
  }

  const assinantes = Array.isArray(contrato.assinaturaAssinantes)
    ? (contrato.assinaturaAssinantes as any[])
    : [];
  const dests = parsed.data.destinatarios ?? [];

  // Resolve número → texto por destinatário
  type Envio = { numero: string; texto: string; para: string };
  const envios: Envio[] = [];

  if (dests.length > 0) {
    for (const email of dests) {
      const ass = assinantes.find((a) => a?.email === email);
      const link = ass?.link ?? contrato.assinaturaUrl;
      const socio = contrato.cliente.socios.find((s) => s.email === email);
      const numero = socio?.telefone?.replace(/\D/g, "");
      if (numero) {
        envios.push({
          numero,
          para: ass?.nome ?? socio?.nome ?? email,
          texto:
            parsed.data.mensagem ??
            `Olá ${ass?.nome ?? socio?.nome ?? ""}! Segue o link para assinatura digital do contrato com a Cestacorp: ${link}`,
        });
      }
    }
  }

  // Fallback: telefone(s) do cliente
  if (envios.length === 0) {
    for (const t of contrato.cliente.telefones) {
      const numero = t.numero.replace(/\D/g, "");
      if (numero) {
        envios.push({
          numero,
          para: contrato.cliente.razaoSocial,
          texto:
            parsed.data.mensagem ??
            `Olá! Segue o link para assinatura digital do contrato com a Cestacorp: ${contrato.assinaturaUrl}`,
        });
      }
    }
  }

  if (envios.length === 0) {
    return NextResponse.json(
      { error: "nenhum número de WhatsApp encontrado para os destinatários" },
      { status: 400 },
    );
  }

  let enviados = 0;
  const erros: { numero: string; motivo: string }[] = [];
  for (const e of envios) {
    try {
      await digisacEnviarMensagem({ number: e.numero, text: e.texto });
      enviados++;
    } catch (err: any) {
      erros.push({
        numero: e.numero,
        motivo: String(err?.response?.data?.message ?? err?.message ?? err).slice(0, 200),
      });
    }
  }

  await audit({
    session,
    action: "contrato.enviar-whatsapp",
    resource: "contrato",
    resourceId: params.id,
    after: { tentados: envios.length, enviados, erros: erros.length },
    request: req,
  });

  return NextResponse.json({ ok: enviados > 0, enviados, tentados: envios.length, erros });
}
