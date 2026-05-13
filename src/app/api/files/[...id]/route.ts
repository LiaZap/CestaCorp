import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { auth } from "@/lib/auth";
import { lerArquivo } from "@/lib/services/storage";

export const runtime = "nodejs";

/**
 * Serve arquivos do storage.
 * GET /api/files/<hash>.<ext>
 * Sessão necessária — para arquivos públicos criar rota dedicada no futuro.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string[] } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = (params.id?.join("/") ?? "").trim();
  const ext = path.extname(raw);
  const hash = raw.slice(0, raw.length - ext.length);

  if (!/^[a-f0-9]{16,64}$/.test(hash)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const r = await lerArquivo(hash, ext);
  if (!r) return NextResponse.json({ error: "não encontrado" }, { status: 404 });

  return new NextResponse(r.buffer as any, {
    headers: {
      "Content-Type": r.mime,
      "Content-Disposition": `inline; filename="${hash}${ext}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
