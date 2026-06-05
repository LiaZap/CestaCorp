import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { Users, Database, Key, Webhook, Settings as SettingsIcon, Shield, Calculator, UserCircle2 } from "lucide-react";
import { IcsFeedCard } from "./IcsFeedCard";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const session = await auth();
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  });

  const env = {
    nibo: Boolean(process.env.NIBO_TOKEN),
    digisac: Boolean(process.env.DIGISAC_TOKEN),
    smtp: Boolean(process.env.SMTP_HOST),
    nextauth: Boolean(process.env.NEXTAUTH_SECRET),
    mongo: Boolean(process.env.MONGODB_URI),
    postgres: Boolean(process.env.DATABASE_URL),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <SettingsIcon className="h-7 w-7" /> Configurações
        </h1>
        <p className="text-muted-foreground">Equipe, integrações e status do ambiente</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Link href="/configuracoes/audit" className="block">
          <Card className="hover:border-cestacorp-blue/40 transition h-full">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-md bg-cestacorp-blue/10 text-cestacorp-blue flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Log de auditoria</p>
                <p className="text-xs text-muted-foreground">Quem fez o quê, quando — exigência LGPD</p>
              </div>
              <span className="text-muted-foreground">→</span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/configuracoes/lgpd" className="block">
          <Card className="hover:border-amber-400/40 transition h-full">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Solicitações LGPD</p>
                <p className="text-xs text-muted-foreground">Pedidos de exclusão de dados (Art. 18 V)</p>
              </div>
              <span className="text-muted-foreground">→</span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/configuracoes/tipos-contrato" className="block">
          <Card className="hover:border-cestacorp-blue/40 transition h-full">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-md bg-cestacorp-blue/10 text-cestacorp-blue flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Tipos de contrato</p>
                <p className="text-xs text-muted-foreground">Cadastrar Aditivo, Encerramento, etc. (Patrick 13/06)</p>
              </div>
              <span className="text-muted-foreground">→</span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/configuracoes/portal-cliente" className="block">
          <Card className="hover:border-cestacorp-blue/40 transition h-full">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <UserCircle2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Portal do cliente — acessos</p>
                <p className="text-xs text-muted-foreground">Gerar links de primeiro acesso (mostra na tela — não depende de SMTP)</p>
              </div>
              <span className="text-muted-foreground">→</span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/configuracoes/webhooks" className="block">
          <Card className="hover:border-cestacorp-blue/40 transition h-full">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center">
                <Webhook className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Saúde dos webhooks</p>
                <p className="text-xs text-muted-foreground">NIBO / Digisac / Autentique — status, últimos eventos, secrets</p>
              </div>
              <span className="text-muted-foreground">→</span>
            </CardContent>
          </Card>
        </Link>

        <Link href="/configuracoes/cobranca" className="block">
          <Card className="hover:border-cestacorp-blue/40 transition h-full">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="h-10 w-10 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Calculator className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Juros e multa de atraso</p>
                <p className="text-xs text-muted-foreground">Regra padrão Cestacorp: 1%/dia + 2% multa</p>
              </div>
              <span className="text-muted-foreground">→</span>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Equipe Cestacorp</CardTitle>
            <CardDescription>{users.length} usuário(s) com acesso ao sistema interno</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Nome</th>
                <th className="py-2 pr-3">E-mail</th>
                <th className="py-2 pr-3">Papel</th>
                <th className="py-2 pr-3">Criado</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{u.name}</td>
                  <td className="py-2 pr-3">{u.email}</td>
                  <td className="py-2 pr-3"><span className="status-badge status-aberto text-[10px]">{u.role}</span></td>
                  <td className="py-2 pr-3 text-xs">{formatDateTime(u.createdAt)}</td>
                  <td className="py-2 pr-3">
                    <span className={"status-badge " + (u.active ? "status-ativo" : "status-aberto")}>
                      {u.active ? "ativo" : "inativo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-3">
            Para criar novos usuários da equipe, ajuste o <code>prisma/seed.ts</code> ou use <code>prisma studio</code>.
            Gestão por UI será adicionada conforme demanda.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> Integrações</CardTitle>
          <CardDescription>Variáveis de ambiente detectadas</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2">
            {[
              ["NIBO", env.nibo, "/api/webhooks/nibo"],
              ["DIGISAC/Hublx", env.digisac, "/api/webhooks/digisac"],
              ["SMTP (e-mail)", env.smtp, null],
              ["NextAuth", env.nextauth, null],
              ["MongoDB", env.mongo, null],
              ["PostgreSQL", env.postgres, null],
            ].map(([label, ok, webhook]: any) => (
              <li key={label} className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{label}</span>
                  {webhook && <span className="text-xs text-muted-foreground ml-2">webhook: <code>{webhook}</code></span>}
                </div>
                <span className={"status-badge " + (ok ? "status-pago" : "status-erro")}>
                  {ok ? "configurado" : "ausente"}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <IcsFeedCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Webhook className="h-5 w-5" /> Rotinas agendadas</CardTitle>
          <CardDescription>O EasyPanel deve disparar estes endpoints</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p><code>POST /api/cron/regua</code> — diário às 09:00 (sync NIBO + régua + agenda + notificações)</p>
          <p className="text-xs text-muted-foreground">Header obrigatório: <code>x-cron-secret: $CRON_SECRET</code> (dedicado — NÃO reusar NEXTAUTH_SECRET)</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Sua conta</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p>Logado como <b>{session?.user?.name}</b> ({session?.user?.email})</p>
          <p className="text-muted-foreground">Papel: {(session?.user as any)?.role ?? "—"}</p>
        </CardContent>
      </Card>
    </div>
  );
}
