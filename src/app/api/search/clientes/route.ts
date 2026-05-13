import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { isEquipe, isCliente } from "@/lib/security/ownership";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json([], { status: 200 });

  // Cliente não busca lista global — só equipe
  if (!isEquipe(session)) {
    // Cliente loggado: devolve apenas o próprio cliente (se corresponder à busca)
    if (isCliente(session)) {
      const clienteId = (session.user as any)?.clienteId;
      if (!clienteId) return NextResponse.json([]);
      const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
      const c = await prisma.cliente.findUnique({
        where: { id: clienteId },
        select: { id: true, razaoSocial: true, nomeFantasia: true, cpfCnpj: true },
      });
      if (!c) return NextResponse.json([]);
      if (!q || c.razaoSocial.toLowerCase().includes(q.toLowerCase()) ||
        c.nomeFantasia?.toLowerCase().includes(q.toLowerCase()) ||
        c.cpfCnpj.includes(q)) {
        return NextResponse.json([c]);
      }
      return NextResponse.json([]);
    }
    return NextResponse.json([], { status: 403 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json([]);

  const clientes = await prisma.cliente.findMany({
    where: {
      OR: [
        { razaoSocial: { contains: q, mode: "insensitive" } },
        { nomeFantasia: { contains: q, mode: "insensitive" } },
        { cpfCnpj: { contains: q } },
      ],
    },
    select: { id: true, razaoSocial: true, nomeFantasia: true, cpfCnpj: true },
    take: 8,
    orderBy: { razaoSocial: "asc" },
  });
  return NextResponse.json(clientes);
}
