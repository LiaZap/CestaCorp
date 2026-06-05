/**
 * Exporta a lista filtrada de clientes como CSV (issue #4 — call 18/05).
 * Aceita os mesmos searchParams da página /clientes — assim o botão
 * "Exportar CSV" do FiltrosClientes pode passar a URL atual direto.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { isEquipe } from "@/lib/security/ownership";
import { buildClientesWhere, ClientesQuery } from "@/lib/services/clientes-query";
import { formatCpfCnpj } from "@/lib/utils";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[";\n,]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isEquipe(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const query: ClientesQuery = Object.fromEntries(sp.entries()) as any;
  const where = await buildClientesWhere(query);

  // Limite de segurança — CSV de 50k linhas estoura memória do server.
  const MAX = 10_000;
  const clientes = await prisma.cliente.findMany({
    where,
    orderBy: { razaoSocial: "asc" },
    take: MAX,
    select: {
      codigo: true,
      razaoSocial: true,
      nomeFantasia: true,
      cpfCnpj: true,
      tipoPessoa: true,
      status: true,
      classificacao: true,
      tributacao: true,
      seguimento: true,
      categoria: true,
      prefeitura: true,
      folha: true,
      respFiscal: true,
      respFolha: true,
      respContabil: true,
      sedeVirtual: true,
      avaliacaoGoogle: true,
      inicio: true,
    },
  });

  const header = [
    "codigo", "razao_social", "nome_fantasia", "cpf_cnpj", "tipo_pessoa",
    "status", "classificacao", "tributacao", "seguimento", "categoria",
    "prefeitura", "folha", "resp_fiscal", "resp_folha", "resp_contabil",
    "sede_virtual", "avaliacao_google", "inicio",
  ];

  const linhas = [header.join(";")];
  for (const c of clientes) {
    linhas.push([
      c.codigo,
      c.razaoSocial,
      c.nomeFantasia,
      formatCpfCnpj(c.cpfCnpj),
      c.tipoPessoa,
      c.status,
      c.classificacao,
      c.tributacao,
      c.seguimento,
      c.categoria,
      c.prefeitura,
      c.folha,
      c.respFiscal,
      c.respFolha,
      c.respContabil,
      c.sedeVirtual ? "sim" : "nao",
      c.avaliacaoGoogle ? "sim" : "nao",
      c.inicio ? c.inicio.toISOString().slice(0, 10) : "",
    ].map(csvEscape).join(";"));
  }

  // BOM pra abrir certinho no Excel BR
  const csv = "﻿" + linhas.join("\r\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
