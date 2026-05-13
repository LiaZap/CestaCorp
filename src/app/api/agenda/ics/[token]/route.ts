import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Feed iCalendar (RFC 5545) da agenda Cestacorp.
 * URL pública (sem login): /api/agenda/ics/{token}
 * Pode ser assinada no Google Calendar, Apple Calendar, Outlook etc.
 *
 * Segurança: o token é um segredo por usuário (gerado em /configuracoes).
 * Revogar = gerar um novo token.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: "token inválido" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { icsToken: token },
    select: { id: true, name: true, email: true, active: true },
  });

  if (!user || !user.active) {
    return NextResponse.json({ error: "token inválido" }, { status: 401 });
  }

  // Filtros opcionais via query string
  const url = new URL(req.url);
  const tagSlug = url.searchParams.get("tag");        // ex: ?tag=simples-nacional
  const tipo = url.searchParams.get("tipo");          // ex: ?tipo=DAS
  const responsavel = url.searchParams.get("responsavel"); // ex: ?responsavel=Camila

  // Próximos 180 dias + últimos 30 (histórico)
  const agora = new Date();
  const inicio = new Date(agora);
  inicio.setDate(inicio.getDate() - 30);
  const fim = new Date(agora);
  fim.setDate(fim.getDate() + 180);

  const where: any = { dataVencimento: { gte: inicio, lte: fim } };

  if (tagSlug) {
    where.cliente = {
      tags: { some: { tag: { slug: tagSlug } } },
    };
  }
  if (tipo) {
    where.obrigacao = { tipo };
  }
  if (responsavel) {
    where.responsavel = { contains: responsavel, mode: "insensitive" };
  }

  const eventos = await prisma.eventoAgenda.findMany({
    where,
    orderBy: { dataVencimento: "asc" },
    include: {
      cliente: { select: { razaoSocial: true, nomeFantasia: true, codigo: true } },
      obrigacao: { select: { tipo: true, descricao: true } },
    },
    take: 500,
  });

  // Sufixo no nome do calendário pra distinguir múltiplos feeds
  const sufixo = tagSlug ? ` · ${tagSlug}` : tipo ? ` · ${tipo}` : responsavel ? ` · ${responsavel}` : "";
  const ics = gerarIcs(eventos, user.name + sufixo);

  const filenameSafe = (sufixo || "").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="cestacorp${filenameSafe}.ics"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}

function gerarIcs(eventos: any[], usuarioNome: string): string {
  const now = formatIcsDate(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cestacorp//Agenda Cestacorp//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Cestacorp · ${escapeText(usuarioNome)}`,
    "X-WR-TIMEZONE:America/Sao_Paulo",
    "X-WR-CALDESC:Obrigações fiscais e eventos de clientes Cestacorp",
  ];

  for (const ev of eventos) {
    const clienteNome = ev.cliente?.nomeFantasia ?? ev.cliente?.razaoSocial ?? "";
    const titulo = clienteNome
      ? `${ev.titulo} · ${clienteNome}`
      : ev.titulo;

    const descricaoParts: string[] = [];
    if (ev.descricao) descricaoParts.push(ev.descricao);
    if (ev.cliente?.codigo) descricaoParts.push(`Cliente cód. ${ev.cliente.codigo}`);
    if (ev.obrigacao) descricaoParts.push(`Obrigação: ${ev.obrigacao.tipo}`);
    if (ev.responsavel) descricaoParts.push(`Responsável: ${ev.responsavel}`);
    descricaoParts.push(`Status: ${ev.status}`);

    const categoria = ev.obrigacao?.tipo ?? "EVENTO";

    // Evento de dia inteiro (vencimento de obrigação)
    const dt = formatIcsDateOnly(ev.dataVencimento);
    const dtEnd = formatIcsDateOnly(addDays(ev.dataVencimento, 1));

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.id}@cestacorp.com.br`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;VALUE=DATE:${dt}`);
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    lines.push(`SUMMARY:${escapeText(titulo)}`);
    if (descricaoParts.length) {
      lines.push(`DESCRIPTION:${escapeText(descricaoParts.join(" · "))}`);
    }
    lines.push(`CATEGORIES:${escapeText(categoria)}`);
    lines.push(`STATUS:${ev.status === "CONCLUIDO" ? "CONFIRMED" : "TENTATIVE"}`);
    if (ev.status === "CANCELADO") lines.push("STATUS:CANCELLED");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // Folding (linhas até 75 chars) + CRLF
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

function formatIcsDate(d: Date): string {
  return (
    d.getUTCFullYear().toString().padStart(4, "0") +
    (d.getUTCMonth() + 1).toString().padStart(2, "0") +
    d.getUTCDate().toString().padStart(2, "0") +
    "T" +
    d.getUTCHours().toString().padStart(2, "0") +
    d.getUTCMinutes().toString().padStart(2, "0") +
    d.getUTCSeconds().toString().padStart(2, "0") +
    "Z"
  );
}

function formatIcsDateOnly(d: Date): string {
  return (
    d.getFullYear().toString().padStart(4, "0") +
    (d.getMonth() + 1).toString().padStart(2, "0") +
    d.getDate().toString().padStart(2, "0")
  );
}

function addDays(d: Date, days: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}

function escapeText(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < line.length) {
    const chunk = line.slice(i, i + 73);
    parts.push(i === 0 ? chunk : " " + chunk);
    i += 73;
  }
  return parts.join("\r\n");
}
