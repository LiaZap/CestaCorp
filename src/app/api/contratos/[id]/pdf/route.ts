import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { docxParaPdf } from "@/lib/services/docx-to-pdf";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const contrato = await prisma.contrato.findUnique({ where: { id: params.id } });
  if (!contrato || !contrato.docxPath) return NextResponse.json({ error: "Contrato sem arquivo" }, { status: 404 });

  const result = await docxParaPdf(contrato.docxPath);

  if (result.pdfPath && fs.existsSync(result.pdfPath)) {
    await prisma.contrato.update({ where: { id: contrato.id }, data: { pdfPath: result.pdfPath } });
    const buf = fs.readFileSync(result.pdfPath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${path.basename(result.pdfPath)}"`,
      },
    });
  }

  // fallback: entrega o .docx
  const buf = fs.readFileSync(contrato.docxPath);
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${path.basename(contrato.docxPath)}"`,
      "X-PDF-Fallback": result.error ?? "libreoffice unavailable",
    },
  });
}
