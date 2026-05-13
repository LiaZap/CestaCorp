import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";
import { gerarContratosEmLote } from "@/lib/services/contrato-generator";

export const runtime = "nodejs";
export const maxDuration = 600;  // 10 min — geração de muitos contratos pode demorar

const Schema = z.object({
  templateId: z.string().min(1),
  // Pode passar IDs explícitos, OU um filtro
  clienteIds: z.array(z.string()).optional(),
  filtro: z.object({
    status: z.enum(["ATIVO", "INATIVO", "PROSPECT"]).optional(),
    classificacao: z.array(z.enum(["BRONZE", "PRATA", "OURO", "TOP"])).optional(),
    tags: z.array(z.string()).optional(),  // slugs
    semContratoDeste: z.boolean().optional(),
  }).optional(),
  forcar: z.boolean().optional(),
  emitir: z.boolean().optional(),
  clausulaPorCliente: z.record(z.string()).optional(),
});

/**
 * POST /api/contratos/gerar-lote
 *
 * Gera contratos em lote pra múltiplos clientes a partir de um template.
 * Patrick: "preciso atualizar todos contratos pra LGPD em lote, com valor atual".
 *
 * Pode receber:
 *   - clienteIds: array explícito
 *   - filtro: critério (status, classificação, tags) → resolve clienteIds
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  // Verifica que o template existe
  const template = await prisma.contratoTemplate.findUnique({ where: { id: d.templateId } });
  if (!template) return NextResponse.json({ error: "template não encontrado" }, { status: 404 });

  // Resolve clienteIds: explícito ou via filtro
  let clienteIds = d.clienteIds ?? [];
  if (clienteIds.length === 0 && d.filtro) {
    const where: any = {};
    if (d.filtro.status) where.status = d.filtro.status;
    if (d.filtro.classificacao && d.filtro.classificacao.length > 0) {
      where.classificacao = { in: d.filtro.classificacao };
    }
    if (d.filtro.tags && d.filtro.tags.length > 0) {
      where.tags = { some: { tag: { slug: { in: d.filtro.tags } } } };
    }
    if (d.filtro.semContratoDeste) {
      where.contratos = {
        none: {
          templateId: d.templateId,
          status: { in: ["EMITIDO", "ASSINADO"] },
        },
      };
    }

    const clientes = await prisma.cliente.findMany({ where, select: { id: true } });
    clienteIds = clientes.map((c) => c.id);
  }

  if (clienteIds.length === 0) {
    return NextResponse.json({ error: "nenhum cliente bate com os critérios" }, { status: 400 });
  }

  // Limita a 500 por execução pra evitar timeouts
  if (clienteIds.length > 500) {
    return NextResponse.json(
      { error: `lote grande demais (${clienteIds.length}). Máximo 500 por execução.` },
      { status: 400 }
    );
  }

  const resultado = await gerarContratosEmLote({
    templateId: d.templateId,
    clienteIds,
    forcar: d.forcar,
    emitir: d.emitir ?? true,
    clausulaPorCliente: d.clausulaPorCliente,
  });

  await audit({
    session,
    action: "contrato.gerar-lote",
    resource: "contrato",
    after: {
      templateId: d.templateId,
      total: resultado.total,
      gerados: resultado.gerados,
      pulados: resultado.pulados,
      erros: resultado.erros,
    },
    request: req,
  });

  return NextResponse.json({
    ok: true,
    template: { id: template.id, nome: template.nome, versao: template.versao },
    ...resultado,
  });
}
