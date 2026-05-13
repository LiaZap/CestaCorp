import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, User, Shield, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { PerfilForm } from "./PerfilForm";
import { TrocarSenhaForm } from "./TrocarSenhaForm";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, email: true, name: true, role: true,
      cargo: true, telefone: true, avatarUrl: true,
      ultimoLogin: true, ultimoLoginIp: true, createdAt: true,
    },
  });

  if (!u) redirect("/login");

  // Últimas 5 ações do próprio usuário
  const ultimasAcoes = await prisma.auditLog.findMany({
    where: { actorId: u.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { action: true, resource: true, createdAt: true, ip: true },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Dashboard
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <User className="h-7 w-7" /> Meu perfil
        </h1>
        <p className="text-muted-foreground">Seus dados, senha e histórico de acesso</p>
      </div>

      <PerfilForm
        initial={{
          name: u.name,
          email: u.email,
          cargo: u.cargo ?? "",
          telefone: u.telefone ?? "",
          avatarUrl: u.avatarUrl ?? "",
        }}
      />

      <TrocarSenhaForm />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" /> Informações de segurança
          </CardTitle>
          <CardDescription>Dados só visíveis para você</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wider">Papel</p>
            <p className="font-semibold mt-0.5">
              {u.role === "ADMIN" ? "Administrador" : u.role === "GESTOR" ? "Gestor" : "Operador"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wider">Membro desde</p>
            <p className="font-semibold mt-0.5">{formatDateTime(u.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wider">Último login</p>
            <p className="font-semibold mt-0.5">{u.ultimoLogin ? formatDateTime(u.ultimoLogin) : "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wider">Último IP</p>
            <p className="font-mono text-xs mt-0.5">{u.ultimoLoginIp ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Suas últimas ações
          </CardTitle>
          <CardDescription>Transparência LGPD</CardDescription>
        </CardHeader>
        <CardContent>
          {ultimasAcoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma ação registrada ainda.</p>
          ) : (
            <ul className="divide-y text-sm">
              {ultimasAcoes.map((a, i) => (
                <li key={i} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs">{a.action}</p>
                    <p className="text-xs text-muted-foreground">{a.resource}{a.ip ? ` · ${a.ip}` : ""}</p>
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0">{formatDateTime(a.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
