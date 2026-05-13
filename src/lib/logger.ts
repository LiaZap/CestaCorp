/**
 * Logger estruturado mínimo — sem deps externas.
 * Emite JSON por linha (fácil de parsear em Datadog/Loki/CloudWatch).
 *
 * Uso:
 *   import { logger } from "@/lib/logger";
 *   logger.info("regua.enviado", { execucaoId, clienteId });
 *   logger.error("regua.falha", err, { execucaoId });
 *
 * Em dev, formata colorido pra ler fácil. Em prod, JSON.
 */

type Level = "debug" | "info" | "warn" | "error" | "fatal";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };
const MIN_LEVEL = (process.env.LOG_LEVEL as Level) ?? (process.env.NODE_ENV === "production" ? "info" : "debug");
const MIN_NUM = LEVELS[MIN_LEVEL] ?? 20;
const IS_PROD = process.env.NODE_ENV === "production";

function stringify(obj: any): string {
  try {
    return JSON.stringify(obj, (_k, v) =>
      v instanceof Error
        ? { name: v.name, message: v.message, stack: v.stack }
        : typeof v === "bigint"
        ? v.toString()
        : v
    );
  } catch {
    return "{}";
  }
}

function formatDev(level: Level, msg: string, meta: Record<string, any>): string {
  const icons: Record<Level, string> = { debug: "🔍", info: "ℹ️", warn: "⚠️", error: "❌", fatal: "💀" };
  const colors: Record<Level, string> = {
    debug: "\x1b[90m",
    info: "\x1b[36m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
    fatal: "\x1b[35m",
  };
  const reset = "\x1b[0m";
  const ts = new Date().toISOString().slice(11, 23);
  const metaStr = Object.keys(meta).length > 0 ? " " + stringify(meta) : "";
  return `${colors[level]}[${ts}] ${icons[level]} ${msg}${reset}${metaStr}`;
}

function emit(level: Level, msg: string, meta: Record<string, any> = {}) {
  if (LEVELS[level] < MIN_NUM) return;
  if (IS_PROD) {
    const entry = { ts: new Date().toISOString(), level, msg, ...meta };
    // eslint-disable-next-line no-console
    console.log(stringify(entry));
  } else {
    // eslint-disable-next-line no-console
    console.log(formatDev(level, msg, meta));
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, any>) => emit("debug", msg, meta),
  info:  (msg: string, meta?: Record<string, any>) => emit("info", msg, meta),
  warn:  (msg: string, meta?: Record<string, any>) => emit("warn", msg, meta),
  error: (msg: string, errOrMeta?: unknown, meta?: Record<string, any>) => {
    const combined: Record<string, any> = { ...(meta ?? {}) };
    if (errOrMeta instanceof Error) combined.err = errOrMeta;
    else if (errOrMeta && typeof errOrMeta === "object") Object.assign(combined, errOrMeta);
    emit("error", msg, combined);
  },
  fatal: (msg: string, errOrMeta?: unknown, meta?: Record<string, any>) => {
    const combined: Record<string, any> = { ...(meta ?? {}) };
    if (errOrMeta instanceof Error) combined.err = errOrMeta;
    else if (errOrMeta && typeof errOrMeta === "object") Object.assign(combined, errOrMeta);
    emit("fatal", msg, combined);
  },

  /**
   * Cria um logger-filho com contexto fixo (ex: por request).
   */
  child(context: Record<string, any>) {
    return {
      debug: (msg: string, meta?: Record<string, any>) => emit("debug", msg, { ...context, ...meta }),
      info:  (msg: string, meta?: Record<string, any>) => emit("info", msg, { ...context, ...meta }),
      warn:  (msg: string, meta?: Record<string, any>) => emit("warn", msg, { ...context, ...meta }),
      error: (msg: string, err?: unknown, meta?: Record<string, any>) => {
        const combined: Record<string, any> = { ...context, ...(meta ?? {}) };
        if (err instanceof Error) combined.err = err;
        else if (err && typeof err === "object") Object.assign(combined, err);
        emit("error", msg, combined);
      },
    };
  },
};

/**
 * Wrapper pra capturar e reportar um erro.
 * Integra com Sentry se configurado.
 */
export async function captureError(err: unknown, context?: Record<string, any>) {
  logger.error("unhandled", err, context);
  // Sentry opcional — só se a dep estiver instalada e env configurada
  if (process.env.SENTRY_DSN) {
    try {
      const dynamicImport = new Function("m", "return import(m)") as (m: string) => Promise<any>;
      const Sentry = await dynamicImport("@sentry/nextjs").catch(() => null);
      if (Sentry) Sentry.captureException(err, { extra: context });
    } catch {}
  }
}
