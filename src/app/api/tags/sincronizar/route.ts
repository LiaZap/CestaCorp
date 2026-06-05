import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";
import { listarTags } from "@/lib/services/digisac";
import { logger } from "@/lib/logger";

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Tags simuladas quando o token Digisac não está configurado (modo demo)
const TAGS_MOCK: { name: string; id: string; cor: string }[] = [
  { id: "dx-cliente-ativo",     name: "Cliente Ativo",          cor: "#10B981" },
  { id: "dx-cliente-encerrado", name: "Cliente Encerrado",      cor: "#94A3B8" },
  { id: "dx-prospect",          name: "Prospect",               cor: "#06B6D4" },
  { id: "dx-atendimento-abert", name: "Atendimento em Aberto",  cor: "#F59E0B" },
  { id: "dx-atend-fiscal",      name: "Atendimento Fiscal",     cor: "#3B82F6" },
  { id: "dx-atend-folha",       name: "Atendimento Folha",      cor: "#8B5CF6" },
  { id: "dx-atend-contabil",    name: "Atendimento Contábil",   cor: "#EC4899" },
  { id: "dx-cobranca-ag",       name: "Cobrança Agendada",      cor: "#F97316" },
  { id: "dx-resposta-pend",     name: "Aguardando Resposta",    cor: "#EAB308" },
  { id: "dx-resolvido",         name: "Resolvido",              cor: "#22C55E" },
];

function tokenValido(): boolean {
  const t = process.env.DIGISAC_TOKEN;
  return Boolean(t && t.length > 10 && !t.startsWith("dev-") && !t.includes("placeholder"));
}

/**
 * Sync de tags com Digisac.
 * Sempre retorna JSON (nunca 500 — erros vão em `erros[]`).
 * Cliente: faz fetch e mostra toast. Não há mais form-submit que deixava
 * o usuário travado em /api/tags/sincronizar quando dava throw.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  try { assertEquipe(session); } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    throw err;
  }

  let items: { id: string; name: string; cor?: string }[] = [];
  let origem = "digisac";
  let modo = "real";

  if (!tokenValido()) {
    items = TAGS_MOCK;
    origem = "digisac-demo";
    modo = "demo";
  } else {
    try {
      const res = await listarTags();
      items = (res?.data || []).map((t: any) => ({ id: t.id, name: t.name }));
      if (items.length === 0) {
        items = TAGS_MOCK;
        origem = "digisac-demo";
        modo = "vazio-fallback";
      }
    } catch (err: any) {
      logger.warn("Digisac listarTags falhou — usando mock", { err: String(err?.message ?? err) });
      items = TAGS_MOCK;
      origem = "digisac-demo";
      modo = "api-indisponivel";
    }
  }

  let novas = 0, atualizadas = 0;
  const erros: { tag: string; motivo: string }[] = [];

  for (const t of items) {
    try {
      const slug = slugify(t.name);
      if (!slug) {
        erros.push({ tag: t.name, motivo: "nome inválido (slug vazio)" });
        continue;
      }
      // Procura por slug OU externoId — não por nome (evita conflito com
      // tags V-106 que têm o mesmo nome mas externoId distinto).
      const exist = await prisma.tag.findFirst({
        where: { OR: [{ slug }, { externoId: t.id }] },
        select: { id: true, externoId: true },
      });
      if (exist) {
        // Não sobrescreve nome (preserva a V-106) — só sincroniza externoId
        // e cor pra correlação com Digisac.
        await prisma.tag.update({
          where: { id: exist.id },
          data: {
            externoId: t.id,
            origem,
            ...(t.cor ? { cor: t.cor } : {}),
          },
        });
        atualizadas++;
      } else {
        // Pode existir tag com mesmo nome mas slug diferente — tenta de novo
        // pelo nome e atualiza em vez de criar (evita P2002 unique nome).
        const porNome = await prisma.tag.findUnique({ where: { nome: t.name }, select: { id: true } });
        if (porNome) {
          await prisma.tag.update({
            where: { id: porNome.id },
            data: { externoId: t.id, origem, ...(t.cor ? { cor: t.cor } : {}) },
          });
          atualizadas++;
        } else {
          await prisma.tag.create({
            data: {
              nome: t.name,
              slug,
              externoId: t.id,
              origem,
              cor: t.cor ?? "#84CC16",
            },
          });
          novas++;
        }
      }
    } catch (err: any) {
      const motivo = String(err?.message ?? err).slice(0, 150);
      erros.push({ tag: t.name, motivo });
      logger.error("sync Digisac tag falhou", { tag: t.name, err: motivo });
    }
  }

  return NextResponse.json({
    ok: true,
    novas,
    atualizadas,
    erros,
    modo,
    totalRecebido: items.length,
  });
}
