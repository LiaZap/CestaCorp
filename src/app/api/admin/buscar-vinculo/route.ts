import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { assertEquipe, AuthorizationError } from "@/lib/security/ownership";
import { prisma } from "@/lib/db/prisma";

/**
 * Busca unificada cliente + pré-cadastro pra modal de vínculo de
 * resposta de formulário. Retorna até 10 de cada lado.
 *
 * Query: ?q=<termo>  (código, CNPJ, CPF, razão social, nome contato)
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { assertEquipe(session); }
  catch (err) {
    if (err instanceof AuthorizationError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ clientes: [], preCadastros: [] });
  }

  const qDigits = q.replace(/\D/g, "");
  const isCodigo = /^\d{1,6}$/.test(q);

  const [clientes, preCadastros] = await Promise.all([
    prisma.cliente.findMany({
      where: {
        deletedAt: null,
        OR: [
          ...(isCodigo ? [{ codigo: Number(q) }] : []),
          { razaoSocial: { contains: q, mode: "insensitive" as const } },
          { nomeFantasia: { contains: q, mode: "insensitive" as const } },
          ...(qDigits.length >= 3 ? [{ cpfCnpj: { contains: qDigits } }] : []),
        ],
      },
      select: { id: true, codigo: true, razaoSocial: true, cpfCnpj: true, status: true, tipoPessoa: true },
      take: 10,
      orderBy: { codigo: "asc" },
    }),
    prisma.preCadastro.findMany({
      where: {
        OR: [
          ...(isCodigo ? [{ codigo: Number(q) }] : []),
          { nomeContato: { contains: q, mode: "insensitive" as const } },
          { nomeEmpresaPretendido: { contains: q, mode: "insensitive" as const } },
          { emailContato: { contains: q, mode: "insensitive" as const } },
          ...(qDigits.length >= 3 ? [{ cpfContato: { contains: qDigits } }, { cnpj: { contains: qDigits } }] : []),
        ],
      },
      select: {
        id: true, codigo: true, nomeContato: true, nomeEmpresaPretendido: true,
        emailContato: true, cpfContato: true, status: true,
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ clientes, preCadastros });
}
