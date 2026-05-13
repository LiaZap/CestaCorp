import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, UserPlus, Building2, ArrowRight, Clock, Check, X } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PENDENTE: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
  EM_ABERTURA: { label: "Em abertura", cls: "bg-blue-100 text-blue-800" },
  VIROU_CLIENTE: { label: "Virou cliente", cls: "bg-emerald-100 text-emerald-800" },
  DESISTIU: { label: "Desistiu", cls: "bg-red-100 text-red-800" },
};

export default async function PreCadastrosPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string };
}) {
  const where: any = {};
  if (searchParams.status && searchParams.status !== "TODOS") {
    where.status = searchParams.status;
  }
  if (searchParams.q) {
    where.OR = [
      { nomeContato: { contains: searchParams.q, mode: "insensitive" } },
      { emailContato: { contains: searchParams.q, mode: "insensitive" } },
      { nomeEmpresaPretendido: { contains: searchParams.q, mode: "insensitive" } },
    ];
  }

  const lista = await prisma.preCadastro.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const counts = await prisma.preCadastro.groupBy({
    by: ["status"],
    _count: true,
  });
  const counters: Record<string, number> = {
    PENDENTE: 0, EM_ABERTURA: 0, VIROU_CLIENTE: 0, DESISTIU: 0,
  };
  for (const c of counts) counters[c.status] = c._count;

  return (
    <div className="space-y-6">
      <Link href="/clientes" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Clientes
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
            <UserPlus className="h-7 w-7" /> Pré-cadastros comerciais
          </h1>
          <p className="text-muted-foreground">
            Clientes que o comercial fechou mas a empresa ainda não foi aberta na Receita
          </p>
        </div>
        <Button asChild>
          <Link href="/clientes/pre-cadastros/novo">
            <Plus className="h-4 w-4" /> Novo pré-cadastro
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(counters).map(([k, v]) => (
          <Card key={k}>
            <CardContent className="pt-5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {STATUS_BADGE[k]?.label}
              </p>
              <p className="text-2xl font-bold mt-1">{v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <form className="flex gap-2 flex-wrap">
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Buscar por nome, e-mail, empresa…"
          className="flex-1 min-w-[240px] max-w-md h-10 rounded-md border bg-background px-3 text-sm"
        />
        <select
          name="status"
          defaultValue={searchParams.status ?? "TODOS"}
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="TODOS">Todos os status</option>
          <option value="PENDENTE">Pendente</option>
          <option value="EM_ABERTURA">Em abertura</option>
          <option value="VIROU_CLIENTE">Virou cliente</option>
          <option value="DESISTIU">Desistiu</option>
        </select>
        <Button variant="secondary" type="submit">Buscar</Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>{lista.length} {lista.length === 1 ? "pré-cadastro" : "pré-cadastros"}</CardTitle>
          <CardDescription>Use o botão "Virar empresa" no detalhe quando a Receita aprovar a abertura</CardDescription>
        </CardHeader>
        <CardContent>
          {lista.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="Nenhum pré-cadastro"
              description="Quando o comercial fechar uma venda mas a empresa ainda não tiver CNPJ, crie aqui."
              cta={{ href: "/clientes/pre-cadastros/novo", label: "Novo pré-cadastro" }}
            />
          ) : (
            <ul className="divide-y">
              {lista.map((p) => {
                const badge = STATUS_BADGE[p.status];
                return (
                  <li key={p.id} className="py-3 flex items-center gap-4 flex-wrap">
                    <div className="h-10 w-10 rounded-md bg-cestacorp-blue/10 text-cestacorp-blue flex items-center justify-center font-bold">
                      {p.codigo ?? "—"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{p.nomeContato}</p>
                        {p.nomeEmpresaPretendido && (
                          <span className="text-muted-foreground text-sm">→ {p.nomeEmpresaPretendido}</span>
                        )}
                        {badge && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badge.cls}`}>
                            {badge.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {p.emailContato} · {p.regimePretendido ?? "regime ?"} · {p.segmento ?? "segmento ?"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Criado {formatDateTime(p.createdAt)}
                        {p.responsavelComercial && ` · comercial: ${p.responsavelComercial}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.clienteId ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/clientes/${p.clienteId}`}>
                            <Check className="h-3 w-3 text-emerald-600" /> Ver cliente
                          </Link>
                        </Button>
                      ) : (
                        <Button asChild size="sm">
                          <Link href={`/clientes/pre-cadastros/${p.id}`}>
                            <Building2 className="h-3 w-3" /> Abrir
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
