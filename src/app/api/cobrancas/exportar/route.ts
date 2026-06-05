import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * Exporta cobranças filtradas como CSV (#55).
 * Lê os mesmos searchParams da listagem.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const vencFrom = sp.get("vencFrom");
  const vencTo = sp.get("vencTo");
  const cliente = sp.get("cliente");
  const classificacao = sp.get("classificacao");

  const where: any = {};
  if (status && status !== "TODOS") where.status = status;
  if (vencFrom || vencTo) {
    where.vencimento = {};
    if (vencFrom) where.vencimento.gte = new Date(vencFrom + "T00:00:00");
    if (vencTo) where.vencimento.lte = new Date(vencTo + "T23:59:59");
  }
  if (cliente) {
    where.cliente = {
      OR: [
        { razaoSocial: { contains: cliente, mode: "insensitive" } },
        { nomeFantasia: { contains: cliente, mode: "insensitive" } },
        { cpfCnpj: { contains: cliente } },
      ],
    };
  }
  if (classificacao && classificacao !== "TODOS") {
    where.cliente = { ...(where.cliente ?? {}), classificacao };
  }

  const rows = await prisma.cobranca.findMany({
    where,
    take: 5000,
    orderBy: { vencimento: "asc" },
    include: { cliente: { select: { razaoSocial: true, cpfCnpj: true, classificacao: true } } },
  });

  const header = ["Cliente", "CNPJ", "Classificação", "Descrição", "Vencimento", "Pago em", "Valor", "Status"];
  const lines = [header.join(";")];
  for (const r of rows) {
    lines.push([
      esc(r.cliente.razaoSocial),
      esc(r.cliente.cpfCnpj),
      esc(r.cliente.classificacao ?? ""),
      esc(r.descricao ?? ""),
      r.vencimento.toISOString().slice(0, 10),
      r.dataPagamento?.toISOString().slice(0, 10) ?? "",
      Number(r.valor).toFixed(2).replace(".", ","),
      r.status,
    ].join(";"));
  }

  const body = "﻿" + lines.join("\r\n"); // BOM pra Excel pt-BR
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cobrancas-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function esc(s: string) {
  if (s == null) return "";
  const v = String(s).replace(/"/g, '""');
  return /[;\r\n"]/.test(v) ? `"${v}"` : v;
}
