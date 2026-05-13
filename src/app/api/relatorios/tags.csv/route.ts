import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * Export CSV: cada linha = cliente × tag. Útil para cruzar com outras ferramentas.
 */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await prisma.clienteTag.findMany({
    include: {
      cliente: { select: { razaoSocial: true, cpfCnpj: true, status: true } },
      tag: { select: { nome: true, origem: true } },
    },
    orderBy: [{ tag: { nome: "asc" } }, { cliente: { razaoSocial: "asc" } }],
  });

  const header = "razao_social,cpf_cnpj,status,tag,origem_tag\n";
  const body = rows.map((r) =>
    [
      `"${r.cliente.razaoSocial.replace(/"/g, '""')}"`,
      r.cliente.cpfCnpj,
      r.cliente.status,
      `"${r.tag.nome.replace(/"/g, '""')}"`,
      r.tag.origem ?? "interno",
    ].join(",")
  ).join("\n");

  const csv = "\uFEFF" + header + body;  // BOM para Excel abrir com acentos

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cestacorp-tags-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
