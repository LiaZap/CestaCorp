import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, Lock, Pencil, ShieldAlert } from "lucide-react";
import { formatCpfCnpj, formatDateTime } from "@/lib/utils";
import { ExclusaoLgpdCard } from "./ExclusaoLgpdCard";

export const dynamic = "force-dynamic";

export default async function PortalMeusDados() {
  const session = await auth();
  const u = session!.user as any;

  const [cliente, solicitacoes] = await Promise.all([
    prisma.cliente.findUnique({
      where: { id: u.clienteId },
      include: { emails: true, telefones: true, socios: true },
    }),
    prisma.solicitacaoExclusaoLgpd.findMany({
      where: { clienteId: u.clienteId },
      orderBy: { solicitadoEm: "desc" },
      take: 5,
    }),
  ]);
  if (!cliente) return null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <User className="h-7 w-7" /> Meus dados
        </h1>
        <p className="text-muted-foreground">Informações cadastradas na Cestacorp</p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Empresa</CardTitle>
            <CardDescription>Para alterações, use o formulário correspondente</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/forms/alteracao-empresa"><Pencil className="h-3 w-3" /> Solicitar alteração</Link>
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Razão social</p>
            <p className="font-medium">{cliente.razaoSocial}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Nome fantasia</p>
            <p className="font-medium">{cliente.nomeFantasia ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">CPF/CNPJ</p>
            <p className="font-medium font-mono">{formatCpfCnpj(cliente.cpfCnpj)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tributação</p>
            <p className="font-medium">{cliente.tributacao ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Contatos</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {cliente.emails.map((e) => (
            <p key={e.id}>
              <span className="text-muted-foreground">✉</span> {e.email}
              {e.principal && <span className="ml-2 text-xs text-cestacorp-green">principal</span>}
            </p>
          ))}
          {cliente.telefones.map((t) => (
            <p key={t.id}>
              <span className="text-muted-foreground">📱</span> {t.numero}
              {t.whatsapp && <span className="ml-2 text-xs text-cestacorp-green">WhatsApp</span>}
            </p>
          ))}
        </CardContent>
      </Card>

      {cliente.socios.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Sócios</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {cliente.socios.map((s) => (
              <div key={s.id} className="border-b last:border-0 pb-2 last:pb-0">
                <p className="font-medium">{s.nome}</p>
                <p className="text-xs text-muted-foreground font-mono">{formatCpfCnpj(s.cpf)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> Segurança</CardTitle>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/portal/esqueci-senha">Alterar minha senha</Link>
          </Button>
        </CardContent>
      </Card>

      <ExclusaoLgpdCard
        solicitacoes={solicitacoes.map((s) => ({
          id: s.id,
          status: s.status,
          motivo: s.motivo,
          decisao: s.decisao,
          solicitadoEm: s.solicitadoEm.toISOString(),
          revisadoEm: s.revisadoEm?.toISOString() ?? null,
          executadoEm: s.executadoEm?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
