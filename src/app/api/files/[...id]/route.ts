import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { auth } from "@/lib/auth";
import { lerArquivo } from "@/lib/services/storage";
import { prisma } from "@/lib/db/prisma";
import { isEquipe, isCliente } from "@/lib/security/ownership";

export const runtime = "nodejs";

/**
 * Serve arquivos do storage.
 * GET /api/files/<hash>.<ext>
 *
 * Auditoria seg #1: antes verificava só `session` — qualquer cliente do
 * portal logado baixava qualquer arquivo (contrato de outro cliente, anexo
 * LGPD, etc.) sabendo o SHA256. Agora valida ownership via FileMetadata:
 *  - equipe: baixa qualquer arquivo
 *  - cliente: só baixa se ownerType=cliente + ownerId === session.clienteId
 *  - escopo "system": liberado pra qualquer usuário autenticado
 *
 * Arquivos legados (sem FileMetadata) só podem ser baixados pela equipe
 * por enquanto — cliente é bloqueado por princípio de menor privilégio.
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

  // Ownership check via FileMetadata
  const meta = await prisma.fileMetadata.findUnique({ where: { hash } });
  const user = session.user as any;

  if (meta) {
    // Escopo system: liberado pra qualquer um autenticado
    if (meta.scope !== "system") {
      // Equipe baixa qualquer arquivo dentro do escritório
      if (!isEquipe(session)) {
        // Cliente do portal: só baixa o que é dele
        if (!isCliente(session) || meta.ownerType !== "cliente" || meta.ownerId !== user.clienteId) {
          return NextResponse.json({ error: "arquivo não acessível pra esta sessão" }, { status: 403 });
        }
      }
    }
  } else {
    // Arquivo legado sem metadata: só equipe baixa (fail closed)
    if (!isEquipe(session)) {
      return NextResponse.json({ error: "arquivo sem metadata — acesso restrito" }, { status: 403 });
    }
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
