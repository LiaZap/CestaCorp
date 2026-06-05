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

/** Envs obrigatórias em produção. Sem elas → process.exit(1).
 *
 *  Mínimo absoluto pra app subir sem inconsistência:
 *  - DB e Mongo (todas as queries quebram sem)
 *  - NEXTAUTH_SECRET/URL (cookies)
 *  - CRON_SECRET (interno — usado pelo scheduler local pra disparar rotas /api/cron)
 */
const REQUIRED_PROD = [
  "DATABASE_URL",
  "MONGODB_URI",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "CRON_SECRET",
] as const;

/** Envs recomendadas em produção. Sem elas → só warn (app sobe normal).
 *
 *  Cada integração tem comportamento defensivo se sua env não estiver setada:
 *  - NIBO/Digisac/Autentique TOKEN ausente → tela mostra "modo demo"
 *  - *_WEBHOOK_SECRET ausente → o handler retorna 503 quando alguém bate
 *    no webhook (não fail-open). Patrick precisa gerar 32 bytes random,
 *    cadastrar no painel da integração, e colar no EasyPanel.
 *  - SMTP_* ausente → enviarEmail() marca "simulado" e loga (não falha
 *    convite/reset de senha; só não envia o email real).
 *
 *  Pra primeiro deploy "pra mostrar pro cliente" só CRON_SECRET é
 *  estritamente necessário. Webhooks/SMTP podem entrar depois.
 */
const RECOMMENDED_PROD = [
  "NIBO_TOKEN",
  "NIBO_WEBHOOK_SECRET",
  "DIGISAC_TOKEN",
  "DIGISAC_WEBHOOK_SECRET",
  "DIGISAC_SERVICE_ID",
  "AUTENTIQUE_TOKEN",
  "AUTENTIQUE_WEBHOOK_SECRET",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  // SMTP_PASS ou SMTP_PASSWORD — pelo menos um (email.ts faz fallback)
  "SMTP_FROM",
  "TZ",
  "SEED_ADMIN_PASSWORD",
  "CERTIFICATE_ENCRYPTION_KEY",
  // OCR (renomeador de PDF): OPENAI_API_KEY OU ANTHROPIC_API_KEY.
  // O check abaixo trata o "OU" — pelo menos um.
] as const;

export function verificarEnvProducao() {
  const isProd = process.env.NODE_ENV === "production";

  const faltando = REQUIRED_PROD.filter((k) => !process.env[k]);

  // SMTP_PASS OU SMTP_PASSWORD precisa existir se SMTP_USER existir
  const temSmtpUser = !!process.env.SMTP_USER;
  const temSmtpPass = !!(process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD);
  const smtpInconsistente = temSmtpUser && !temSmtpPass;

  const avisos = RECOMMENDED_PROD.filter((k) => !process.env[k]);

  // OCR: precisa de pelo menos uma das duas chaves (OPENAI/ANTHROPIC).
  // Sem nenhuma, o renomeador de NF retorna erro claro pra cada arquivo.
  const temOcrKey = Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
  if (!temOcrKey) avisos.push("OPENAI_API_KEY OU ANTHROPIC_API_KEY (renomeador de NF)" as any);

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
