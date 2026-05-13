import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { audit } from "@/lib/security/audit";

export const runtime = "nodejs";

const schema = z.object({
  senhaAtual: z.string().min(1, "senha atual obrigatória"),
  senhaNova: z.string().min(8, "senha nova precisa de pelo menos 8 caracteres").max(128),
});

/** POST /api/me/password — trocar senha própria */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "dados inválidos", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { senhaAtual, senhaNova } = parsed.data;

  // Validação de força mínima
  if (!/[A-Z]/.test(senhaNova) || !/[a-z]/.test(senhaNova) || !/[0-9]/.test(senhaNova)) {
    return NextResponse.json(
      { error: "senha precisa ter ao menos 1 maiúscula, 1 minúscula e 1 número" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });

  const ok = await bcrypt.compare(senhaAtual, user.password);
  if (!ok) {
    return NextResponse.json({ error: "senha atual incorreta" }, { status: 400 });
  }

  const mesma = await bcrypt.compare(senhaNova, user.password);
  if (mesma) {
    return NextResponse.json({ error: "a nova senha deve ser diferente da atual" }, { status: 400 });
  }

  const hash = await bcrypt.hash(senhaNova, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password: hash },
  });

  await audit({
    session,
    action: "me.password.change",
    resource: "user",
    resourceId: user.id,
    request: req,
  });

  return NextResponse.json({ ok: true });
}
