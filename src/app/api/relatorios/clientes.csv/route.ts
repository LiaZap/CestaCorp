import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const clientes = await prisma.cliente.findMany({
    include: { emails: { where: { principal: true }, take: 1 }, telefones: { where: { principal: true }, take: 1 } },
    orderBy: { razaoSocial: "asc" },
  });

  const header = "codigo,razao_social,cpf_cnpj,status,classificacao,tributacao,resp_fiscal,resp_folha,resp_contabil,mes_reajuste,indice_reajuste,email,telefone\n";
  const body = clientes.map((c) =>
    [
      c.codigo ?? "",
      `"${c.razaoSocial.replace(/"/g, '""')}"`,
      c.cpfCnpj,
      c.status,
      c.classificacao ?? "",
      c.tributacao ?? "",
      c.respFiscal ?? "",
      c.respFolha ?? "",
      c.respContabil ?? "",
      c.mesAniversarioReajuste ?? "",
      c.indiceReajuste ?? "",
      c.emails[0]?.email ?? "",
      c.telefones[0]?.numero ?? "",
    ].join(",")
  ).join("\n");

  const csv = "\uFEFF" + header + body;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cestacorp-clientes-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
