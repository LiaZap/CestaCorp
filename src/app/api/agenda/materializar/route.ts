import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { materializaEventos } from "@/lib/services/agenda";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = await materializaEventos(90);
    return NextResponse.redirect(
      new URL(`/agenda?gen=${result.criados}`, process.env.NEXTAUTH_URL || "http://localhost:3000"),
      303
    );
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
