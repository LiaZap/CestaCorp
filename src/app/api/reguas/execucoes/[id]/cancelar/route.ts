import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await prisma.execucaoRegua.updateMany({
    where: { id: params.id, status: "PENDENTE" },
    data: { status: "CANCELADO", erro: `Cancelado manualmente por ${session.user?.email ?? "usuário"}` },
  });

  return NextResponse.redirect(
    new URL(`/regua-cobranca/execucao/${params.id}`, process.env.NEXTAUTH_URL || "http://localhost:3000"),
    303
  );
}
