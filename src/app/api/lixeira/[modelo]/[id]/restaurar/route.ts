import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/security/roles";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";

const MAP: Record<string, any> = {
  cliente: "cliente",
  contrato: "contrato",
  cobranca: "cobranca",
  evento: "eventoAgenda",
};

export async function POST(
  req: NextRequest,
  { params }: { params: { modelo: string; id: string } },
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(session)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const key = MAP[params.modelo];
  if (!key) return NextResponse.json({ error: "modelo_invalido" }, { status: 400 });

  await (prisma as any)[key].update({
    where: { id: params.id },
    data: { deletedAt: null },
  });

  await audit({
    session, action: "lixeira.restaurar", resource: params.modelo, resourceId: params.id,
    before: { deleted: true }, after: { deleted: false }, request: req,
  });

  return NextResponse.json({ ok: true });
}
