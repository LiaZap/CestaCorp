import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { simularReajustePorCliente } from "@/lib/services/reajuste";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const proposta = await simularReajustePorCliente(params.id);
  if (!proposta) return NextResponse.json({ error: "Sem dados para simular" }, { status: 400 });
  return NextResponse.redirect(
    new URL(`/reajustes?cliente=${params.id}&sim=1`, req.nextUrl.origin),
    303
  );
}
