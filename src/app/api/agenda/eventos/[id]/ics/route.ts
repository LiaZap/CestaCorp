import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { gerarIcs } from "@/lib/services/ical";

/**
 * Exporta um EventoAgenda como arquivo .ics (RFC 5545) — #92.
 * Cliente importa no Google Calendar / Outlook / Apple Calendar.
 *
 * Acesso:
 *  - Equipe (sessão NextAuth) → qualquer evento
 *  - Cliente do portal → só eventos vinculados ao próprio clienteId
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const evento = await prisma.eventoAgenda.findUnique({
    where: { id: params.id },
    include: {
      cliente: { select: { id: true, razaoSocial: true } },
      obrigacao: { select: { tipo: true, antecedenciaDias: true } },
    },
  });
  if (!evento) return NextResponse.json({ error: "evento não encontrado" }, { status: 404 });

  // Cliente só vê eventos próprios
  const tipo = (session.user as any).tipo;
  if (tipo === "cliente") {
    const acessoClienteId = (session.user as any).clienteId;
    if (acessoClienteId && evento.clienteId !== acessoClienteId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const descricao = [
    evento.descricao,
    evento.cliente && `Cliente: ${evento.cliente.razaoSocial}`,
    evento.obrigacao?.tipo && `Tipo: ${evento.obrigacao.tipo}`,
    "Importado do sistema Cestacorp",
  ].filter(Boolean).join("\n");

  const ics = gerarIcs({
    uid: evento.id,
    titulo: evento.titulo,
    descricao,
    dataVencimento: evento.dataVencimento,
    alertaDiasAntes: evento.obrigacao?.antecedenciaDias ?? 1,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="evento-${evento.id.slice(0, 8)}.ics"`,
      "cache-control": "no-store",
    },
  });
}
