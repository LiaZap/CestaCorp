import { NextRequest, NextResponse } from "next/server";
import { connectMongo } from "@/lib/db/mongo";
import { FormResponseModel } from "@/models/FormResponse";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await req.formData();
  const status = String(form.get("status") ?? "");
  if (!["RECEBIDO", "EM_ANALISE", "APLICADO", "REJEITADO"].includes(status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }
  await connectMongo();
  await FormResponseModel.updateOne({ _id: params.id }, { $set: { status } });
  return NextResponse.redirect(
    new URL(`/formularios/${params.id}`, process.env.NEXTAUTH_URL || "http://localhost:3000"),
    303
  );
}
