import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { marcarComoLida } from "@/lib/services/notifications";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  await marcarComoLida(params.id, (session.user as any).id);
  return NextResponse.json({ ok: true });
}
