/**
 * Scheduler interno do Cestacorp — substitui a dependência de cron externo
 * (EasyPanel scheduler / k8s CronJob) durante o desenvolvimento e ambientes
 * pequenos. Roda como serviço dedicado no docker-compose. (#78)
 *
 * Horários (timezone: TZ env — default America/Sao_Paulo):
 *   - 09:00 dias úteis        → /api/cron/regua          (envia mensagens diárias)
 *   - 09:00 diariamente       → /api/cron/aniversarios   (parabeniza sócios/empresas)
 *   - 03:00 dia 1 do mês      → /api/cron/expurgo        (limpa dados antigos)
 *
 * Configuração:
 *   - SCHEDULER_ENABLED=true            → habilita
 *   - SCHEDULER_BASE_URL=http://app:3000 → URL interna do app dentro da rede docker
 *   - CRON_SECRET=…                     → mesmo segredo do app
 *   - TZ=America/Sao_Paulo              → timezone dos schedules
 *
 * Pra rodar localmente fora do docker:
 *   SCHEDULER_ENABLED=true SCHEDULER_BASE_URL=http://localhost:3000 CRON_SECRET=devsecret \
 *     node scripts/run-scheduler.js
 *
 * Evento de fallback: se a chamada HTTP falhar, loga e segue — o próximo tick
 * vai tentar de novo. NUNCA derruba o processo: o objetivo é continuar de pé
 * mesmo quando o app está reiniciando.
 */

const cron = require("node-cron");

const enabled = (process.env.SCHEDULER_ENABLED ?? "").toLowerCase();
if (enabled !== "true" && enabled !== "1") {
  console.log("[scheduler] SCHEDULER_ENABLED não está true — encerrando sem agendar.");
  process.exit(0);
}

const BASE_URL = (process.env.SCHEDULER_BASE_URL ?? "http://app:3000").replace(/\/$/, "");
const CRON_SECRET = process.env.CRON_SECRET ?? "";
const TZ = process.env.TZ ?? "America/Sao_Paulo";

if (!CRON_SECRET) {
  console.error("[scheduler] CRON_SECRET vazio — recuso subir pra não bater endpoint sem auth.");
  process.exit(1);
}

/**
 * Dispara um endpoint de cron com timeout e tratamento de erro.
 * `fetch` global está disponível no Node 18+.
 */
async function dispararCron(nome, path) {
  const url = `${BASE_URL}${path}`;
  const inicio = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10 * 60_000); // 10 min

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "x-cron-secret": CRON_SECRET, "content-type": "application/json" },
      signal: controller.signal,
    });
    const ms = Date.now() - inicio;
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.error(
        `[scheduler] ${nome} falhou (HTTP ${r.status}, ${ms}ms): ${body.slice(0, 300)}`,
      );
      return;
    }
    console.log(`[scheduler] ${nome} ok (${ms}ms)`);
  } catch (err) {
    console.error(`[scheduler] ${nome} erro:`, err?.message ?? err);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * cron syntax: "min hour day-of-month month day-of-week"
 *   - "0 9 * * 1-5" = 09:00 de seg(1)..sex(5)
 *   - "0 9 * * *"   = 09:00 todos os dias
 *   - "0 3 1 * *"   = 03:00 dia 1 de cada mês
 */
const jobs = [
  { nome: "regua",         expr: "0 9 * * 1-5", path: "/api/cron/regua" },
  { nome: "aniversarios",  expr: "0 9 * * *",   path: "/api/cron/aniversarios" },
  { nome: "expurgo",       expr: "0 3 1 * *",   path: "/api/cron/expurgo" },
];

console.log(`[scheduler] iniciando · TZ=${TZ} · base=${BASE_URL}`);
for (const j of jobs) {
  cron.schedule(
    j.expr,
    () => {
      console.log(`[scheduler] tick ${j.nome} (${j.expr})`);
      dispararCron(j.nome, j.path);
    },
    { timezone: TZ },
  );
  console.log(`[scheduler] agendado: ${j.nome} (${j.expr})`);
}

// Mantém o processo vivo. node-cron já segura o event loop, mas
// dejarretamos signal handlers pra logs claros em shutdown.
process.on("SIGINT", () => { console.log("[scheduler] SIGINT — encerrando"); process.exit(0); });
process.on("SIGTERM", () => { console.log("[scheduler] SIGTERM — encerrando"); process.exit(0); });
