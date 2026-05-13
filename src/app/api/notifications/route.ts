import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { contarNaoLidas, listarNotificacoes, marcarTodasComoLidas } from "@/lib/services/notifications";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  const unread = req.nextUrl.searchParams.get("unread") === "1";
  const [items, unreadCount] = await Promise.all([
    listarNotificacoes(userId, { unreadOnly: unread, limit: 30 }),
    contarNaoLidas(userId),
  ]);
  return NextResponse.json({ items, unreadCount });
}

export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = (session.user as any).id;
  await marcarTodasComoLidas(userId);
  return NextResponse.json({ ok: true });
}
