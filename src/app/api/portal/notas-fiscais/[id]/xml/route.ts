import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * Download de XML de NF pra cliente do portal (#95).
 * IDOR check: nota.clienteId precisa bater com o cliente logado.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const u = session.user as any;
  if (u.tipo !== "cliente") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const nf = await prisma.notaFiscal.findUnique({
    where: { id: params.id },
    select: { clienteId: true, xmlPath: true, numero: true, dataEmissao: true },
  });
  if (!nf) return NextResponse.json({ error: "não encontrada" }, { status: 404 });
  if (nf.clienteId !== u.clienteId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!nf.xmlPath || !fs.existsSync(nf.xmlPath)) {
    return NextResponse.json({ error: "XML não disponível" }, { status: 404 });
  }

  const buffer = fs.readFileSync(nf.xmlPath);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "content-type": "application/xml",
      "content-disposition": `attachment; filename="nf-${nf.numero}.xml"`,
      "cache-control": "no-store",
    },
  });
}
