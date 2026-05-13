import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { gerarContratoDocx } from "@/lib/services/contrato-generator";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { clienteId, templateId } = await req.json();
  if (!clienteId || !templateId) {
    return NextResponse.json({ error: "clienteId e templateId são obrigatórios" }, { status: 400 });
  }
  try {
    const result = await gerarContratoDocx({ clienteId, templateId });
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
