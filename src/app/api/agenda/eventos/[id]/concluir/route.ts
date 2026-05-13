import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { concluirEvento } from "@/lib/services/agenda";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await req.formData();
  const observacao = String(form.get("observacao") ?? "") || undefined;
  const autor = session.user?.name || session.user?.email || "equipe";
  await concluirEvento(params.id, autor, observacao);
  return NextResponse.redirect(
    new URL(`/agenda/${params.id}`, process.env.NEXTAUTH_URL || "http://localhost:3000"),
    303
  );
}
