import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { rateLimit } from "@/lib/security/rate-limit";
import { importarNFe } from "@/lib/services/nfe-parser";
import { uploadArquivo } from "@/lib/services/storage";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";
export const maxDuration = 600;  // 10 minutos pra lotes grandes

const MAX_ARQUIVOS_POR_LOTE = 500;

export async function POST(req: NextRequest) {
  // Rate limit aumentado: 5 lotes de até 500 arquivos a cada 10 minutos
  const rl = rateLimit(req, "nfe-import", { max: 5, windowMs: 10 * 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "muitos lotes" }, { status: 429, headers: rl.headers });

  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const form = await req.formData();
  const files = form.getAll("files") as File[];
  if (files.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }
  if (files.length > MAX_ARQUIVOS_POR_LOTE) {
    return NextResponse.json(
      { error: `Lote grande demais (${files.length}). Máximo: ${MAX_ARQUIVOS_POR_LOTE} arquivos por execução. Divida em múltiplos uploads.` },
      { status: 400 }
    );
  }

  const userId = (session.user as any).id;
  const resultados: any[] = [];

  // Processa em chunks de 20 paralelos (concurrency-limited) — não trava a memória
  // nem mata o Postgres com inserts simultâneos.
  const CHUNK_SIZE = 20;
  for (let i = 0; i < files.length; i += CHUNK_SIZE) {
    const chunk = files.slice(i, i + CHUNK_SIZE);
    const parciais = await Promise.all(
      chunk.map(async (file) => {
        try {
          const buf = Buffer.from(await file.arrayBuffer());
          let xmlPath: string | undefined;
          try {
            const up = await uploadArquivo({
              name: file.name, mime: file.type || "application/xml", buffer: buf,
              ownerId: userId, ownerType: "user",
            });
            xmlPath = up.url;
          } catch {}

          const r = await importarNFe(buf, { userId, xmlPath });
          return {
            arquivo: file.name,
            chave: r.chave,
            criado: r.criado,
            vinculado: r.clienteVinculado,
            notaId: r.notaId,
          };
        } catch (err: any) {
          return {
            arquivo: file.name,
            erro: String(err?.message ?? err).slice(0, 200),
          };
        }
      })
    );
    resultados.push(...parciais);
  }

  const criadas = resultados.filter((r) => r.criado).length;
  const duplicadas = resultados.filter((r) => r.criado === false && !r.erro).length;
  const erros = resultados.filter((r) => r.erro).length;

  await audit({
    session, action: "nfe.import", resource: "nota_fiscal",
    after: { total: files.length, criadas, duplicadas, erros },
    request: req,
  });

  return NextResponse.json({
    ok: true,
    resumo: { total: files.length, criadas, duplicadas, erros },
    resultados,
  });
}
