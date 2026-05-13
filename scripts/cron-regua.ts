/**
 * Executa a régua de cobrança uma vez e encerra o processo.
 * Uso local:   npm run cron:regua
 * EasyPanel: agendar este comando, OU chamar o endpoint /api/cron/regua
 */
import "dotenv/config";
import { rodarReguaDiaria } from "@/lib/services/regua-cobranca";

(async () => {
  console.log("[regua] iniciando", new Date().toISOString());
  try {
    const resultado = await rodarReguaDiaria();
    console.log("[regua] concluído:", JSON.stringify(resultado, null, 2));
    process.exit(0);
  } catch (err) {
    console.error("[regua] erro:", err);
    process.exit(1);
  }
})();
