import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { listarTags } from "@/lib/services/digisac";

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const base = req.nextUrl.origin;

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
    } catch (err) {
      items = TAGS_MOCK;
      origem = "digisac-demo";
      modo = "fallback";
    }
  }

  let novas = 0, atualizadas = 0;
  for (const t of items) {
    const slug = slugify(t.name);
    const exist = await prisma.tag.findFirst({
      where: { OR: [{ slug }, { externoId: t.id }] },
    });
    if (exist) {
      await prisma.tag.update({
        where: { id: exist.id },
        data: { nome: t.name, externoId: t.id, origem, ...(t.cor ? { cor: t.cor } : {}) },
      });
      atualizadas++;
    } else {
      await prisma.tag.create({
        data: { nome: t.name, slug, externoId: t.id, origem, cor: t.cor ?? "#84CC16" },
      });
      novas++;
    }
  }

  return NextResponse.redirect(
    new URL(`/tags?synced=1&novas=${novas}&atualizadas=${atualizadas}&modo=${modo}`, base),
    303
  );
}
