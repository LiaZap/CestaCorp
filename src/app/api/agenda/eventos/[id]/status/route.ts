import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await req.formData();
  const status = String(form.get("status") ?? "");
  if (!["PENDENTE","CONCLUIDO","ATRASADO","ISENTO","CANCELADO"].includes(status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }
  await prisma.eventoAgenda.update({
    where: { id: params.id },
    data: { status: status as any },
  });
  return NextResponse.redirect(
    new URL(`/agenda/${params.id}`, process.env.NEXTAUTH_URL || "http://localhost:3000"),
    303
  );
}
