/**
 * Guard rail arquitetural — Patrick (09/05/2026):
 *   "Cobrança nasce com snapshot da regra. Mudança é prospectiva."
 *
 * Esta promessa só funciona se TODA criação passar pela factory `criarCobranca()`.
 * Se alguém usar `prisma.cobranca.create()` direto, a cobrança nasce sem snapshot
 * e fica órfã (recalcula retroativamente quando admin mudar a regra).
 *
 * Este teste varre o código-fonte e falha se aparecer `prisma.cobranca.create`
 * fora dos arquivos autorizados (a própria factory + scripts de retrofill).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");

// Arquivos onde prisma.cobranca.create é PERMITIDO (single source of truth):
const PERMITIDOS = [
  // a própria factory implementa o create
  "src/lib/services/cobranca-factory.ts",
  // testes que mockam ou testam a factory diretamente
  "tests/unit/cobranca-factory.test.ts",
  // scripts de retrofill que precisam controlar snapshot manualmente
  "scripts/popular-snapshot-cobrancas.ts",
];

function listarArquivos(dir: string, base: string = dir): string[] {
  const out: string[] = [];
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome === ".next" || nome === ".git" || nome === "dist") continue;
    const caminho = join(dir, nome);
    const st = statSync(caminho);
    if (st.isDirectory()) {
      out.push(...listarArquivos(caminho, base));
    } else if (/\.(ts|tsx|js)$/.test(nome) && !nome.endsWith(".d.ts")) {
      out.push(caminho);
    }
  }
  return out;
}

describe("guard rail: prisma.cobranca.create só na factory", () => {
  it("nenhum arquivo não-autorizado usa prisma.cobranca.create", () => {
    const offenders: { arquivo: string; linha: number; texto: string }[] = [];
    const dirs = ["src", "scripts", "prisma"].map((d) => join(ROOT, d));

    for (const dir of dirs) {
      try {
        const arquivos = listarArquivos(dir);
        for (const arq of arquivos) {
          const rel = arq.replace(ROOT + "\\", "").replace(ROOT + "/", "").replace(/\\/g, "/");
          if (PERMITIDOS.includes(rel)) continue;

          const conteudo = readFileSync(arq, "utf-8");
          const linhas = conteudo.split("\n");
          linhas.forEach((linha, i) => {
            // Detecta "prisma.cobranca.create" e "tx.cobranca.create" (transações).
            // Permite "createMany" (que também passa pela factory) — só queremos travar o `create` singular.
            // Permite "create:" (input do prisma.create) usado dentro do data: { ... }
            if (
              /\b(?:prisma|tx|client)\.cobranca\.create\b(?!Many)/.test(linha)
              && !linha.trim().startsWith("//")
              && !linha.trim().startsWith("*")
            ) {
              offenders.push({ arquivo: rel, linha: i + 1, texto: linha.trim() });
            }
          });
        }
      } catch {
        // dir não existe — ok
      }
    }

    if (offenders.length > 0) {
      const msg = offenders
        .map((o) => `  ${o.arquivo}:${o.linha} → ${o.texto}`)
        .join("\n");
      throw new Error(
        `\n❌ Encontrei ${offenders.length} uso(s) de prisma.cobranca.create fora da factory.\n` +
        `Use criarCobranca() de "@/lib/services/cobranca-factory" pra que o snapshot da regra de juros seja capturado automaticamente (Patrick 09/05).\n\n` +
        `Ofensores:\n${msg}\n\n` +
        `Se for caso legítimo (ex: novo script de migration), adicione o caminho em PERMITIDOS no teste.`
      );
    }
    expect(offenders).toHaveLength(0);
  });
});
