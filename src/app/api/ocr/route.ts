import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ocrDocumento } from "@/lib/services/ocr";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * OCR de documentos fiscais.
 * Aceita multipart/form-data com campo `file`.
 * Retorna JSON com dados extraídos + campo `provider` (claude | mock).
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(req, "ocr", { max: 30, windowMs: 5 * 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "muitos OCRs, aguarde" }, { status: 429, headers: rl.headers });

  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: rl.headers });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "arquivo ausente" }, { status: 400, headers: rl.headers });

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await ocrDocumento({ buffer: buf, mime: file.type });
    return NextResponse.json(result, { headers: rl.headers });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500, headers: rl.headers });
  }
}
