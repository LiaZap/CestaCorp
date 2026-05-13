import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { getMovimentacaoMes, getHistoricoAnual, getDistribuicaoAtual } from "@/lib/services/movimentacao";

export const runtime = "nodejs";

/**
 * GET /api/relatorios/movimentacao
 *   ?ano=2026&mes=4              → movimentação do mês
 *   ?ano=2026&modo=anual         → histórico anual completo
 *   ?modo=distribuicao           → snapshot atual por regime/classificação/prefeitura
 *
 * GET /api/relatorios/movimentacao?ano=2026&mes=4&format=csv → exporta CSV
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const { searchParams } = new URL(req.url);
  const modo = searchParams.get("modo") ?? "mes";
  const ano = Number(searchParams.get("ano") ?? new Date().getFullYear());
  const mes = Number(searchParams.get("mes") ?? (new Date().getMonth() + 1));
  const format = searchParams.get("format");

  if (modo === "anual") {
    return NextResponse.json(await getHistoricoAnual(ano));
  }

  if (modo === "distribuicao") {
    return NextResponse.json(await getDistribuicaoAtual());
  }

  // modo "mes" (default)
  const dados = await getMovimentacaoMes(ano, mes);

  if (format === "csv") {
    const linhas: string[] = [];
    linhas.push(`Movimentação ${ano}-${String(mes).padStart(2, "0")}`);
    linhas.push("");
    linhas.push(`ENTRADAS (${dados.entradas.length})`);
    linhas.push("Código,Razão Social,Nome Fantasia,CPF/CNPJ,Tributação,Classificação,Início,Honorário");
    for (const c of dados.entradas) {
      linhas.push([
        c.codigo ?? "",
        `"${c.razaoSocial.replace(/"/g, '""')}"`,
        `"${(c.nomeFantasia ?? "").replace(/"/g, '""')}"`,
        c.cpfCnpj,
        `"${(c.tributacao ?? "").replace(/"/g, '""')}"`,
        c.classificacao ?? "",
        c.inicio ?? "",
        c.honorario ?? "",
      ].join(","));
    }
    linhas.push("");
    linhas.push(`SAÍDAS (${dados.saidas.length})`);
    linhas.push("Código,Razão Social,CPF/CNPJ,Tributação,Encerrado em");
    for (const c of dados.saidas) {
      linhas.push([
        c.codigo ?? "",
        `"${c.razaoSocial.replace(/"/g, '""')}"`,
        c.cpfCnpj,
        `"${(c.tributacao ?? "").replace(/"/g, '""')}"`,
        c.fim ?? "",
      ].join(","));
    }

    return new NextResponse("﻿" + linhas.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="movimentacao-${ano}-${String(mes).padStart(2, "0")}.csv"`,
      },
    });
  }

  return NextResponse.json(dados);
}
