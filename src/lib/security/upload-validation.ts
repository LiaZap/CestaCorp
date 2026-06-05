/**
 * Validação de uploads — MIME + magic bytes.
 *
 * Auditoria #46: antes só checava `file.type` (header Content-Type que o
 * cliente envia). Atacante podia subir SVG/HTML/EXE com mime "image/png"
 * e armazenar arquivos maliciosos no /uploads.
 *
 * Agora exige magic bytes via `file-type` (lib oficial sindresorhus/file-type).
 * `.docx` e `.xlsx` na verdade são ZIP por baixo — a lib reconhece e devolve
 * o mime OOXML correto.
 *
 * SVG é REJEITADO de propósito: pode conter <script> e XSS via SVG é vetor real.
 * HTML também — não temos use case pra subir HTML.
 *
 * Uso:
 *   const r = await validarUpload(buffer, declaredMime, "filename.pdf");
 *   if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
 *   // r.mime é o mime REAL detectado, use esse pra gravar
 */

// file-type 22 é ESM-only — usamos Function constructor pra escapar do
// transform do webpack/turbopack e fazer dynamic import em runtime.
// eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
const dynImport = new Function("m", "return import(m)") as (m: string) => Promise<any>;

/** MIMEs permitidos. Tudo que NÃO está aqui é rejeitado. */
export const ALLOWED_MIMES = new Set<string>([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",       // .xlsx
  "application/xml",
  "text/xml",
]);

/** MIMEs perigosos — bloqueados explicitamente mesmo se forem parecidos. */
const BLOCKED_MIMES = new Set<string>([
  "image/svg+xml",          // SVG pode conter <script>
  "text/html",
  "application/xhtml+xml",
  "application/x-msdownload", // .exe
  "application/x-executable",
  "application/x-sh",
  "application/javascript",
  "text/javascript",
  "text/x-php",
  "application/x-php",
]);

/** Extensões que indicam scripts/executáveis — bloqueio defensivo por nome. */
const BLOCKED_EXTS = new Set<string>([
  ".svg", ".html", ".htm", ".xhtml",
  ".exe", ".bat", ".cmd", ".ps1", ".sh",
  ".js", ".mjs", ".cjs", ".php", ".phtml",
  ".jsp", ".asp", ".aspx",
]);

export interface ValidacaoOk {
  ok: true;
  /** MIME real detectado pelos magic bytes (preferir esse ao declarado). */
  mime: string;
  /** Extensão sugerida pela lib (sem ponto). */
  ext: string;
}

export interface ValidacaoErro {
  ok: false;
  error: string;
}

export type ResultadoValidacao = ValidacaoOk | ValidacaoErro;

/**
 * Valida um upload checando magic bytes contra a allowlist.
 *
 * @param buffer  conteúdo binário do arquivo (após `Buffer.from(await file.arrayBuffer())`)
 * @param declaredMime  o que o cliente disse que era (header Content-Type)
 * @param nomeArquivo opcional, usado pra checar extensão suspeita
 */
export async function validarUpload(
  buffer: Buffer,
  declaredMime: string,
  nomeArquivo?: string,
): Promise<ResultadoValidacao> {
  if (!buffer || buffer.length === 0) {
    return { ok: false, error: "Arquivo vazio" };
  }

  const declared = (declaredMime || "").toLowerCase().split(";")[0].trim();

  // 1. Bloqueio rápido por mime declarado
  if (BLOCKED_MIMES.has(declared)) {
    return { ok: false, error: `Tipo de arquivo não permitido (${declared})` };
  }

  // 2. Bloqueio por extensão suspeita
  if (nomeArquivo) {
    const lower = nomeArquivo.toLowerCase();
    const dotIdx = lower.lastIndexOf(".");
    if (dotIdx >= 0) {
      const ext = lower.slice(dotIdx);
      if (BLOCKED_EXTS.has(ext)) {
        return { ok: false, error: `Extensão não permitida (${ext})` };
      }
    }
  }

  // 3. Magic bytes
  let detected: { mime: string; ext: string } | undefined;
  try {
    const mod = await dynImport("file-type");
    const r = await mod.fileTypeFromBuffer(buffer);
    if (r) detected = { mime: r.mime, ext: r.ext };
  } catch {
    // Se file-type falhar (ex.: TXT/CSV/XML que não tem magic bytes claros),
    // permitimos só se o mime declarado for um caso conhecido sem magic.
  }

  // 4. XML é caso especial — não tem magic bytes confiáveis (texto), aceitamos
  //    pelo declared se for XML e o conteúdo começa com `<?xml` ou tag.
  if (!detected) {
    if (declared === "application/xml" || declared === "text/xml") {
      const head = buffer.slice(0, 256).toString("utf8").trimStart();
      if (head.startsWith("<?xml") || head.startsWith("<")) {
        // Defesa extra: rejeitar XML com DOCTYPE (XXE / HTML disfarçado).
        if (/<!DOCTYPE/i.test(head)) {
          return { ok: false, error: "XML com DOCTYPE não é permitido" };
        }
        if (/<html[\s>]/i.test(head) || /<script[\s>]/i.test(head)) {
          return { ok: false, error: "Conteúdo HTML detectado em arquivo XML" };
        }
        return { ok: true, mime: "application/xml", ext: "xml" };
      }
    }
    return { ok: false, error: "Não foi possível identificar o tipo do arquivo" };
  }

  // 5. Mime detectado tem que estar na allowlist
  if (BLOCKED_MIMES.has(detected.mime)) {
    return { ok: false, error: `Conteúdo detectado como tipo bloqueado (${detected.mime})` };
  }
  if (!ALLOWED_MIMES.has(detected.mime)) {
    return { ok: false, error: `Tipo de arquivo não permitido (${detected.mime})` };
  }

  return { ok: true, mime: detected.mime, ext: detected.ext };
}

/**
 * Retorna true se o mime corresponde a uma imagem renderizável inline com
 * segurança no navegador. Usado para decidir Content-Disposition em /api/files.
 */
export function isImagemSegura(mime: string): boolean {
  return mime === "image/png" || mime === "image/jpeg" || mime === "image/webp";
}
