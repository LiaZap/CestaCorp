import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

/**
 * GET  — devolve o token atual do usuário (gera se não existir)
 * POST — regenera o token (revoga o antigo)
 */

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const userId = (session.user as any).id;
  let user = await prisma.user.findUnique({ where: { id: userId }, select: { icsToken: true } });

  let token = user?.icsToken;
  if (!token) {
    token = crypto.randomBytes(24).toString("hex");
    await prisma.user.update({ where: { id: userId }, data: { icsToken: token } });
  }

  return NextResponse.json({ token, url: buildIcsUrl(token) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const userId = (session.user as any).id;
  const token = crypto.randomBytes(24).toString("hex");
  await prisma.user.update({ where: { id: userId }, data: { icsToken: token } });

  await audit({
    session,
    action: "agenda.ics.rotate",
    resource: "user",
    resourceId: userId,
    request: req,
  });

  return NextResponse.json({ token, url: buildIcsUrl(token) });
}

function buildIcsUrl(token: string): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/agenda/ics/${token}`;
}
