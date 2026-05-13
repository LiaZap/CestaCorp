import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { ExclusoesLgpdClient } from "./ExclusoesLgpdClient";

export const dynamic = "force-dynamic";

export default async function LgpdPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = (session.user as any).role;
  if (role !== "ADMIN") {
    return (
      <div className="max-w-xl">
        <Card>
          <CardHeader><CardTitle>Acesso restrito</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Apenas administradores podem revisar solicitações LGPD.
          </CardContent>
        </Card>
      </div>
    );
  }

  const lista = await prisma.solicitacaoExclusaoLgpd.findMany({
    orderBy: [{ status: "asc" }, { solicitadoEm: "desc" }],
    include: {
      cliente: {
        select: { id: true, codigo: true, razaoSocial: true, cpfCnpj: true, status: true },
      },
    },
  });

  const counts = {
    PENDENTE: 0, APROVADA: 0, NEGADA: 0, EXECUTADA: 0,
  };
  for (const s of lista) counts[s.status as keyof typeof counts]++;

  return (
    <div className="space-y-6 max-w-5xl">
      <Link href="/configuracoes" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Configurações
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <ShieldAlert className="h-7 w-7" /> LGPD · Solicitações de exclusão
        </h1>
        <p className="text-muted-foreground">
          Clientes pediram exclusão de dados (Art. 18 V). Prazo legal de resposta: 15 dias úteis.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pendentes</p>
          <p className="text-2xl font-bold text-amber-600">{counts.PENDENTE}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Aprovadas</p>
          <p className="text-2xl font-bold text-blue-600">{counts.APROVADA}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Negadas</p>
          <p className="text-2xl font-bold text-red-600">{counts.NEGADA}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Executadas</p>
          <p className="text-2xl font-bold text-emerald-600">{counts.EXECUTADA}</p>
        </CardContent></Card>
      </div>

      <ExclusoesLgpdClient
        solicitacoes={lista.map((s) => ({
          id: s.id,
          status: s.status,
          motivo: s.motivo,
          decisao: s.decisao,
          solicitadoEm: s.solicitadoEm.toISOString(),
          revisadoEm: s.revisadoEm?.toISOString() ?? null,
          executadoEm: s.executadoEm?.toISOString() ?? null,
          cliente: s.cliente,
        }))}
      />
    </div>
  );
}
