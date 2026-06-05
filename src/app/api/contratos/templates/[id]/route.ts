import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await req.formData();
  const method = String(form.get("_method") ?? "");
  if (method === "DELETE") {
    await prisma.contratoTemplate.update({ where: { id: params.id }, data: { ativo: false } });
    return NextResponse.redirect(new URL("/contratos/templates", req.nextUrl.origin), 303);
  }
  return NextResponse.json({ error: "método desconhecido" }, { status: 400 });
}
