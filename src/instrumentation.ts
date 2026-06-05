/**
 * Boot hook do Next.js (App Router).
 * Roda UMA VEZ no startup do servidor — tanto em `next start` quanto em
 * runtime do standalone (server.js). Não roda em build time.
 *
 * Doc: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Aqui validamos as envs obrigatórias antes que qualquer request chegue.
 * Em produção, faltar env crítica → process.exit(1) (fail-fast).
 */

export async function register() {
  // só roda no runtime Node (não em edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { verificarEnvProducao } = await import("./lib/env-guard");
    verificarEnvProducao();
  }
}
