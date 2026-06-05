/**
 * Boot guard de variáveis de ambiente.
 *
 * Em produção (NODE_ENV=production) o app PRECISA ter um conjunto mínimo de
 * envs setadas pra não ficar em estado inconsistente:
 *  - sem NEXTAUTH_SECRET/URL → cookies inválidos
 *  - sem MONGODB_URI/DATABASE_URL → todas as queries quebram
 *  - sem *_WEBHOOK_SECRET em prod → webhooks aceitam payloads não-assinados
 *    (fail open), o que é pior do que rejeitar tudo
 *  - sem CRON_SECRET → rotas de cron viram público
 *
 * Em dev (NODE_ENV !== production) só avisa, não derruba.
 *
 * Chamado em src/instrumentation.ts no boot do Next.js.
 */

/** Envs obrigatórias em produção. Sem elas → process.exit(1). */
const REQUIRED_PROD = [
  "DATABASE_URL",
  "MONGODB_URI",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "CRON_SECRET",
  "NIBO_TOKEN",
  "NIBO_WEBHOOK_SECRET",
  "DIGISAC_TOKEN",
  "DIGISAC_WEBHOOK_SECRET",
  "DIGISAC_SERVICE_ID",
  "AUTENTIQUE_TOKEN",
  "AUTENTIQUE_WEBHOOK_SECRET",
] as const;

/** Envs recomendadas em produção. Sem elas → só warn. */
const RECOMMENDED_PROD = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  // SMTP_PASS ou SMTP_PASSWORD — pelo menos um (email.ts faz fallback)
  "SMTP_FROM",
  "TZ",
  "SEED_ADMIN_PASSWORD",
] as const;

export function verificarEnvProducao() {
  const isProd = process.env.NODE_ENV === "production";

  const faltando = REQUIRED_PROD.filter((k) => !process.env[k]);

  // SMTP_PASS OU SMTP_PASSWORD precisa existir se SMTP_USER existir
  const temSmtpUser = !!process.env.SMTP_USER;
  const temSmtpPass = !!(process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD);
  const smtpInconsistente = temSmtpUser && !temSmtpPass;

  const avisos = RECOMMENDED_PROD.filter((k) => !process.env[k]);

  if (isProd && faltando.length > 0) {
    // eslint-disable-next-line no-console
    console.error("[env-guard] FATAL: envs obrigatórias ausentes em produção:");
    for (const k of faltando) console.error(`  - ${k}`);
    console.error("Configure no painel do EasyPanel antes de subir.");
    // Em produção, NÃO sobe sem o mínimo.
    process.exit(1);
  }

  if (isProd && smtpInconsistente) {
    // eslint-disable-next-line no-console
    console.error("[env-guard] FATAL: SMTP_USER definido mas SMTP_PASS/SMTP_PASSWORD ausente.");
    process.exit(1);
  }

  if (avisos.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(`[env-guard] envs recomendadas ausentes (${isProd ? "PROD" : "dev"}):`, avisos.join(", "));
  }

  if (!isProd && faltando.length > 0) {
    // eslint-disable-next-line no-console
    console.warn("[env-guard] dev: envs faltando (não bloqueante):", faltando.join(", "));
  }
}
