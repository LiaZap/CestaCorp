import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { audit } from "@/lib/security/audit";
import { importarV106Completo } from "@/lib/services/v106-importer";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutos — V-106 com 2k+ clientes pode demorar

/**
 * Importador da V106 — processa CLIENTES + TAGS HUBLX + ANIVERSARIANTES + EMAILS.
 * Idempotente: pode rodar várias vezes sem duplicar.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const resultados = await importarV106Completo(buffer);

    const totalNovos = resultados.reduce((acc, r) => acc + r.novos, 0);
    const totalAtualizados = resultados.reduce((acc, r) => acc + r.atualizados, 0);
    const totalIgnorados = resultados.reduce((acc, r) => acc + r.ignorados, 0);

    await audit({
      session,
      action: "v106.import",
      resource: "cliente",
      after: { totalNovos, totalAtualizados, totalIgnorados, abas: resultados.length },
      request: req,
    });

    return NextResponse.json({
      ok: true,
      resumo: { totalNovos, totalAtualizados, totalIgnorados },
      abas: resultados,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Falha ao processar planilha", detalhe: String(err?.message ?? err).slice(0, 300) },
      { status: 500 }
    );
  }
}
