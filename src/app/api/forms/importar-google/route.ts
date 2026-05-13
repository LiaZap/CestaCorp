import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { importarGoogleFormXlsx } from "@/lib/services/google-forms-import";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const slug = String(form.get("slug") ?? "").trim();
  const title = String(form.get("title") ?? "") || undefined;
  const category = String(form.get("category") ?? "") || undefined;

  if (!file || !slug) {
    return NextResponse.json({ error: "Arquivo e slug obrigatórios" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importarGoogleFormXlsx(buffer, slug, { title, category });
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
