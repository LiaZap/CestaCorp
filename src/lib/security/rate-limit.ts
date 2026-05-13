/**
 * Rate limiter em memória (token bucket).
 * Para MVP com 1 container — pra múltiplas instâncias usar Upstash/Redis.
 *
 * API:
 *   const r = rateLimit(req, "portal-login", { max: 5, windowMs: 5 * 60_000 });
 *   if (!r.ok) return NextResponse.json({ error: "muitas tentativas" }, { status: 429, headers: r.headers });
 */

import type { NextRequest } from "next/server";

type BucketEntry = { count: number; resetAt: number };

const buckets = new Map<string, BucketEntry>();

function getIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

function limpaExpirados(agora: number) {
  // Garbage collection simples — roda 1/100 hits
  if (Math.random() > 0.01) return;
  for (const [k, v] of buckets) {
    if (v.resetAt < agora) buckets.delete(k);
  }
}

export interface RateLimitOptions {
  max: number;
  windowMs: number;
  /** Quando true, não incrementa se já estourou (evita lockout eterno em dev) */
  skipIncrementAfterLimit?: boolean;
}

export interface RateLimitResult {
  ok: boolean;
  restante: number;
  total: number;
  resetInSec: number;
  headers: Record<string, string>;
}

export function rateLimit(
  req: NextRequest,
  bucket: string,
  opts: RateLimitOptions
): RateLimitResult {
  const agora = Date.now();
  limpaExpirados(agora);

  const ip = getIp(req);
  const key = `${bucket}:${ip}`;

  let entry = buckets.get(key);
  if (!entry || entry.resetAt < agora) {
    entry = { count: 0, resetAt: agora + opts.windowMs };
    buckets.set(key, entry);
  }

  const ok = entry.count < opts.max;
  if (ok || !opts.skipIncrementAfterLimit) entry.count++;

  const restante = Math.max(0, opts.max - entry.count);
  const resetInSec = Math.ceil((entry.resetAt - agora) / 1000);

  return {
    ok,
    restante,
    total: opts.max,
    resetInSec,
    headers: {
      "X-RateLimit-Limit": String(opts.max),
      "X-RateLimit-Remaining": String(restante),
      "X-RateLimit-Reset": String(Math.floor(entry.resetAt / 1000)),
      ...(ok ? {} : { "Retry-After": String(resetInSec) }),
    },
  };
}
