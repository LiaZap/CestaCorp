import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/security/roles";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";

const MAP: Record<string, string> = {
  cliente: "cliente",
  contrato: "contrato",
  cobranca: "cobranca",
  evento: "eventoAgenda",
};

export async function DELETE(
  req: NextRequest,
  { params }: { params: { modelo: string; id: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const key = MAP[params.modelo];
  if (!key) return NextResponse.json({ error: "modelo_invalido" }, { status: 400 });

  // Usa o RAW client pra fazer DELETE real (a extension converte para soft-delete)
  await (prisma as any)[key].delete({ where: { id: params.id } });

  await audit({
    session, action: "lixeira.purgar", resource: params.modelo, resourceId: params.id,
    before: { id: params.id }, after: null, request: req,
  });

  return NextResponse.json({ ok: true });
}
