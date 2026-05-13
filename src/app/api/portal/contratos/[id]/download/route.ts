import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { docxParaPdf } from "@/lib/services/docx-to-pdf";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const u = session.user as any;

  const contrato = await prisma.contrato.findFirst({
    where: { id: params.id, clienteId: u.clienteId },
  });
  if (!contrato || !contrato.docxPath) {
    return NextResponse.json({ error: "Contrato não disponível" }, { status: 404 });
  }

  const { pdfPath } = await docxParaPdf(contrato.docxPath);
  const file = pdfPath && fs.existsSync(pdfPath) ? pdfPath : contrato.docxPath;
  const isPdf = file.endsWith(".pdf");
  const buf = fs.readFileSync(file);

  return new NextResponse(buf, {
    headers: {
      "Content-Type": isPdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `inline; filename="${path.basename(file)}"`,
    },
  });
}
