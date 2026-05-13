import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";
import { invalidarCacheConfig } from "@/lib/services/valor-atualizado";

export const runtime = "nodejs";

const Schema = z.object({
  jurosPctAoDia: z.number().min(0).max(100),
  multaPct: z.number().min(0).max(100),
  carenciaDias: z.number().int().min(0).max(90),
  jurosCompostos: z.boolean(),
  ativo: z.boolean().optional(),
});

/** GET — devolve config atual (cria default se não existir). */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const cfg = await prisma.configCobranca.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  return NextResponse.json({
    jurosPctAoDia: Number(cfg.jurosPctAoDia),
    multaPct: Number(cfg.multaPct),
    carenciaDias: cfg.carenciaDias,
    jurosCompostos: cfg.jurosCompostos,
    ativo: cfg.ativo,
    atualizadoEm: cfg.atualizadoEm,
    atualizadoPor: cfg.atualizadoPor,
  });
}

/** PUT — atualiza a config global. */
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const before = await prisma.configCobranca.findUnique({ where: { id: "default" } });

  const updated = await prisma.configCobranca.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      jurosPctAoDia: d.jurosPctAoDia,
      multaPct: d.multaPct,
      carenciaDias: d.carenciaDias,
      jurosCompostos: d.jurosCompostos,
      ativo: d.ativo ?? true,
      atualizadoPor: session.user.id,
    },
    update: {
      jurosPctAoDia: d.jurosPctAoDia,
      multaPct: d.multaPct,
      carenciaDias: d.carenciaDias,
      jurosCompostos: d.jurosCompostos,
      ativo: d.ativo ?? true,
      atualizadoPor: session.user.id,
    },
  });

  invalidarCacheConfig();

  await audit({
    session,
    action: "config-cobranca.update",
    resource: "config_cobranca",
    resourceId: "default",
    before, after: updated,
    request: req,
  });

  return NextResponse.json({ ok: true });
}
