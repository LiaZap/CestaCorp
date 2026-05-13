import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/Avatar";
import { ArrowLeft, Users, Plus } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { UsersClient } from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if ((session.user as any).role !== "ADMIN") {
    return (
      <div className="max-w-xl">
        <Card>
          <CardHeader><CardTitle>Acesso restrito</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Apenas administradores podem gerenciar usuários. Solicite ao admin do sistema.
          </CardContent>
        </Card>
      </div>
    );
  }

  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true, email: true, name: true, role: true, active: true,
      cargo: true, telefone: true, createdAt: true,
    },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/configuracoes" className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Configurações
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <Users className="h-7 w-7" /> Equipe Cestacorp
        </h1>
        <p className="text-muted-foreground">{users.length} usuário(s) · só ADMIN pode gerenciar</p>
      </div>

      <UsersClient
        usuarios={users.map((u) => ({
          id: u.id,
          nome: u.name,
          email: u.email,
          role: u.role,
          active: u.active,
          cargo: u.cargo,
          telefone: u.telefone,
          createdAt: u.createdAt.toISOString(),
        }))}
        currentUserId={session.user.id}
      />
    </div>
  );
}
