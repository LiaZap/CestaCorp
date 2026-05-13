import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const nome = String(form.get("nome") ?? "").trim();
  const tipo = String(form.get("tipo") ?? "OUTROS");
  const file = form.get("file") as File | null;
  if (!nome || !file) return NextResponse.json({ error: "Nome e arquivo obrigatórios" }, { status: 400 });

  const dir = path.join(process.cwd(), "uploads", "templates");
  fs.mkdirSync(dir, { recursive: true });
  const safe = nome.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const filename = `${safe}-${Date.now()}.docx`;
  const full = path.join(dir, filename);
  fs.writeFileSync(full, Buffer.from(await file.arrayBuffer()));

  const template = await prisma.contratoTemplate.create({
    data: { nome, tipo, arquivoDocx: full, ativo: true },
  });

  return NextResponse.json({ ok: true, id: template.id }, { status: 201 });
}
