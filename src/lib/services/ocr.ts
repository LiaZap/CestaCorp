/**
 * OCR de documentos fiscais (nota fiscal, comprovante, boleto).
 *
 * Providers suportados (ordem de preferência):
 *   1. OpenAI    (OPENAI_API_KEY)    — preferido pelo Patrick (13/06).
 *      Usa Responses API com gpt-4o-mini que aceita PDFs nativamente
 *      como input_file (base64 data URL).
 *   2. Anthropic (ANTHROPIC_API_KEY) — fallback histórico.
 *      Claude com vision; aceita PDF via `type: "document"`.
 *   3. Mock      — fallback determinístico pra dev/demo (sem nenhuma key).
 *
 * O provider escolhido vai no campo `provider` da resposta — `renomear-nf`
 * usa isso pra avisar "modo mock" se nenhuma chave estiver setada.
 *
 * Extrai:
 *   - valor (R$)
 *   - data de emissão / vencimento
 *   - CNPJ emissor / tomador
 *   - número da nota
 *   - descrição/objeto
 *   - tipo: "nota_fiscal" | "boleto" | "comprovante" | "outro"
 */

export interface ResultadoOcr {
  tipo: "nota_fiscal" | "boleto" | "comprovante" | "outro";
  valor?: number;
  dataEmissao?: string;
  dataVencimento?: string;
  cnpjEmissor?: string;
  cnpjTomador?: string;
  numero?: string;
  descricao?: string;
  confianca: number; // 0-1
  raw?: string;
  provider: "openai" | "claude" | "mock";
}

const SYSTEM = `Você é um assistente de extração de dados de documentos fiscais brasileiros.
Extraia as informações em JSON com esses campos:
- tipo: "nota_fiscal" | "boleto" | "comprovante" | "outro"
- valor: número (sem R$, ponto como decimal)
- dataEmissao: "YYYY-MM-DD"
- dataVencimento: "YYYY-MM-DD" (se aplicável)
- cnpjEmissor: string (só dígitos)
- cnpjTomador: string (só dígitos)
- numero: string
- descricao: string curta (máx 80 chars; nome do tomador se for NF de prestação)
- confianca: 0 a 1 (quão seguro você está)
Retorne APENAS o JSON, sem comentários, sem markdown.`;

// Import dinâmico que escapa da análise estática do webpack — só resolve
// em runtime se a dep estiver instalada. Evita erro de build quando o
// agente sobe sem @anthropic-ai/sdk OU sem openai.
const dynamicImport = new Function("m", "return import(m)") as (m: string) => Promise<any>;

export async function ocrDocumento(params: {
  buffer: Buffer;
  mime: string;
  /**
   * Força provider específico. Padrão: auto (openai → claude → mock).
   * Útil em testes ou pra comparar resultados entre providers.
   */
  forceProvider?: "openai" | "claude" | "mock";
}): Promise<ResultadoOcr> {
  const preferOpenai = !params.forceProvider || params.forceProvider === "openai";
  const preferClaude = !params.forceProvider || params.forceProvider === "claude";

  // 1) OpenAI (preferido)
  if (preferOpenai && process.env.OPENAI_API_KEY) {
    try {
      return await ocrViaOpenAi(params);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn("[ocr] openai falhou, tentando fallback:", String(err?.message ?? err).slice(0, 200));
      if (params.forceProvider === "openai") return mockOcr(params); // forçado → não cai pra claude
    }
  }

  // 2) Anthropic (fallback)
  if (preferClaude && process.env.ANTHROPIC_API_KEY) {
    try {
      return await ocrViaAnthropic(params);
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn("[ocr] anthropic falhou, caindo pra mock:", String(err?.message ?? err).slice(0, 200));
    }
  }

  // 3) Mock
  return mockOcr(params);
}

// ────────────────────────────────────────────────────────────────────────
// OPENAI (gpt-4o-mini via Responses API — aceita PDF e imagens nativos)
// ────────────────────────────────────────────────────────────────────────
async function ocrViaOpenAi(params: { buffer: Buffer; mime: string }): Promise<ResultadoOcr> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const { default: OpenAI } = await dynamicImport("openai").catch(() => ({ default: null as any }));
  if (!OpenAI) throw new Error("pacote `openai` não instalado");

  const client = new OpenAI({ apiKey });
  const base64 = params.buffer.toString("base64");
  const isPdf = params.mime.includes("pdf");
  const model = process.env.OPENAI_OCR_MODEL ?? "gpt-4o-mini";

  // Responses API aceita PDFs como input_file (data URL). Pra imagens,
  // input_image. Os dois cabem no mesmo "content" array.
  const content: any[] = [{ type: "input_text", text: "Extraia os dados deste documento." }];

  if (isPdf) {
    content.unshift({
      type: "input_file",
      filename: "documento.pdf",
      file_data: `data:application/pdf;base64,${base64}`,
    });
  } else {
    content.unshift({
      type: "input_image",
      image_url: `data:${params.mime};base64,${base64}`,
    });
  }

  const resp: any = await client.responses.create({
    model,
    instructions: SYSTEM,
    input: [{ role: "user", content }],
    // Output formato JSON estruturado — OpenAI Responses suporta json_object
    text: { format: { type: "json_object" } },
  });

  // Texto agregado vem em `resp.output_text` (helper do SDK 6.x).
  // Se não tiver, varre `resp.output[].content[].text`.
  let txt: string = resp.output_text ?? "";
  if (!txt && Array.isArray(resp.output)) {
    for (const item of resp.output) {
      if (item.type === "message" && Array.isArray(item.content)) {
        for (const c of item.content) {
          if (c.type === "output_text" && typeof c.text === "string") txt += c.text;
        }
      }
    }
  }

  const json = limpaJson(txt);
  const parsed = JSON.parse(json);
  return { ...parsed, provider: "openai" };
}

// ────────────────────────────────────────────────────────────────────────
// ANTHROPIC (claude — fallback)
// ────────────────────────────────────────────────────────────────────────
async function ocrViaAnthropic(params: { buffer: Buffer; mime: string }): Promise<ResultadoOcr> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const { default: Anthropic } = await dynamicImport("@anthropic-ai/sdk").catch(() => ({ default: null as any }));
  if (!Anthropic) throw new Error("pacote `@anthropic-ai/sdk` não instalado");

  const client = new Anthropic({ apiKey });
  const base64 = params.buffer.toString("base64");
  const isPdf = params.mime.includes("pdf");
  const model = process.env.ANTHROPIC_OCR_MODEL ?? "claude-sonnet-4-20250514";

  const msg = await client.messages.create({
    model,
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{
      role: "user",
      content: [
        {
          type: isPdf ? "document" as any : "image" as any,
          source: { type: "base64", media_type: params.mime, data: base64 },
        },
        { type: "text", text: "Extraia os dados deste documento." },
      ],
    }],
  });

  const txt = msg.content
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("")
    .trim();

  const json = limpaJson(txt);
  const parsed = JSON.parse(json);
  return { ...parsed, provider: "claude" };
}

/** Remove ```json ... ``` ou explicações antes do { e depois do }. */
function limpaJson(s: string): string {
  let t = s.replace(/```json?/gi, "").replace(/```/g, "").trim();
  // Pega o primeiro JSON object da string (alguns modelos retornam texto antes)
  const inicio = t.indexOf("{");
  const fim = t.lastIndexOf("}");
  if (inicio >= 0 && fim > inicio) t = t.slice(inicio, fim + 1);
  return t;
}

/**
 * Mock determinístico baseado no nome/tamanho — útil em dev e demos.
 * Sinaliza `provider: "mock"` pra UI alertar que não é OCR real.
 */
function mockOcr(params: { buffer: Buffer; mime: string }): ResultadoOcr {
  const hash = params.buffer.subarray(0, 32).reduce((a, b) => a + b, 0);
  const valores = [450, 890, 1250, 1850, 2400, 3100, 4500];
  const valor = valores[hash % valores.length];
  const hoje = new Date();
  const venc = new Date(hoje); venc.setDate(venc.getDate() + 10);
  const tipos: ResultadoOcr["tipo"][] = ["nota_fiscal", "boleto", "comprovante"];

  return {
    tipo: tipos[hash % tipos.length],
    valor,
    dataEmissao: hoje.toISOString().slice(0, 10),
    dataVencimento: venc.toISOString().slice(0, 10),
    cnpjEmissor: "07784052000145",
    numero: `NF-${String(hash % 999999).padStart(6, "0")}`,
    descricao: "Prestação de serviços — exemplo",
    confianca: 0.65,
    provider: "mock",
  };
}
