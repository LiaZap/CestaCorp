import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadArquivo } from "@/lib/services/storage";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * Upload genérico. Aceita multipart/form-data com campo `file`.
 * Retorna { id, url, nome, mime, tamanho } — id é o SHA256 do conteúdo.
 * Limita: 15MB · 30 uploads/5min por IP.
 */
export async function POST(req: NextRequest) {
  const rl = rateLimit(req, "upload", { max: 30, windowMs: 5 * 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "muitos uploads, aguarde" }, { status: 429, headers: rl.headers });

  const session = await auth();
  // Uploads podem vir de formulários públicos (sem session) ou área autenticada
  const u = session?.user as any;

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "arquivo ausente" }, { status: 400, headers: rl.headers });

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await uploadArquivo({
      name: file.name,
      mime: file.type || "application/octet-stream",
      buffer: buf,
      ownerId: u?.clienteId ?? u?.id,
      ownerType: u?.tipo === "cliente" ? "cliente" : u?.id ? "user" : "system",
    });
    return NextResponse.json(result, { headers: rl.headers });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 400, headers: rl.headers });
  }
}
