import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { connectMongo } from "@/lib/db/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint público de health check.
 * - GET /api/health       → liveness simples (app rodando)
 * - GET /api/health?deep=1 → readiness (DB + Mongo + envs críticas)
 *
 * Retorna 200 se tudo ok, 503 se algo quebrou.
 * EasyPanel/Kubernetes usam isso pra decidir se reinicia o container.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const deep = url.searchParams.get("deep") === "1";
  const started = Date.now();

  const base = {
    ok: true,
    uptime: Math.round(process.uptime()),
    version: process.env.npm_package_version ?? "dev",
    node: process.version,
    ts: new Date().toISOString(),
  };

  if (!deep) return NextResponse.json(base);

  // Readiness — checa dependências
  const checks: Record<string, { ok: boolean; latencyMs?: number; message?: string }> = {};

  // Postgres
  {
    const t0 = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.postgres = { ok: true, latencyMs: Date.now() - t0 };
    } catch (err: any) {
      checks.postgres = { ok: false, message: String(err?.message ?? err).slice(0, 200) };
    }
  }

  // MongoDB
  {
    const t0 = Date.now();
    try {
      const conn = await connectMongo();
      const ping = await conn.connection.db?.admin().ping();
      checks.mongo = { ok: Boolean(ping?.ok), latencyMs: Date.now() - t0 };
    } catch (err: any) {
      checks.mongo = { ok: false, message: String(err?.message ?? err).slice(0, 200) };
    }
  }

  // Env crítica
  const envRequeridas = ["NEXTAUTH_SECRET", "DATABASE_URL", "MONGODB_URI"];
  const faltando = envRequeridas.filter((k) => !process.env[k]);
  checks.env = {
    ok: faltando.length === 0,
    message: faltando.length > 0 ? `faltando: ${faltando.join(", ")}` : undefined,
  };

  // Integrações opcionais (warning, não erro)
  checks.nibo = { ok: Boolean(process.env.NIBO_TOKEN && !process.env.NIBO_TOKEN.startsWith("dev-")) };
  checks.digisac = { ok: Boolean(process.env.DIGISAC_TOKEN && !process.env.DIGISAC_TOKEN.startsWith("dev-")) };

  const criticasOk = checks.postgres.ok && checks.mongo.ok && checks.env.ok;

  return NextResponse.json(
    { ...base, ok: criticasOk, checks, totalLatencyMs: Date.now() - started },
    { status: criticasOk ? 200 : 503 }
  );
}
