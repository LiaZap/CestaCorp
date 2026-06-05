import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { gerarLinkConvite } from "@/lib/services/cliente-auth";
import { audit } from "@/lib/security/audit";

/**
 * Gera/renova convite do portal de cliente SEM mandar email.
 * Retorna o link pronto pra equipe copiar e enviar via WhatsApp/manual.
 *
 * Diferente de POST /api/clientes/[id]/convite (que manda email).
 * Use este quando SMTP ainda não está configurado ou pra suporte ao vivo.
 */
const Schema = z.object({
  email: z.string().email(),
  nome: z.string().min(2),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try { assertEquipe(session); }
  catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  try {
    const result = await gerarLinkConvite({
      clienteId: params.id,
      email: parsed.data.email,
      nome: parsed.data.nome,
    });

    await audit({
      session,
      action: "cliente.acesso.gerar-link",
      resource: "cliente",
      resourceId: params.id,
      after: { email: parsed.data.email, jaExistia: result.jaExistia },
      request: req,
    });

    return NextResponse.json({
      ok: true,
      link: result.link,
      expiraEm: result.expiraEm.toISOString(),
      jaExistia: result.jaExistia,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err).slice(0, 200) }, { status: 500 });
  }
}
