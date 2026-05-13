import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rodarReguaDiaria } from "@/lib/services/regua-cobranca";

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const resultado = await rodarReguaDiaria();
    return NextResponse.redirect(
      new URL("/regua-cobranca?ran=1", process.env.NEXTAUTH_URL || "http://localhost:3000"),
      303
    );
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
