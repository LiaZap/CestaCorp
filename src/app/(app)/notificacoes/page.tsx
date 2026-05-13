import Link from "next/link";
import { auth } from "@/lib/auth";
import { listarNotificacoes } from "@/lib/services/notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { Bell } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NotificacoesPage() {
  const session = await auth();
  const userId = (session!.user as any).id;
  const items = await listarNotificacoes(userId, { limit: 100 });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-cestacorp-blue flex items-center gap-2">
          <Bell className="h-7 w-7" /> Notificações
        </h1>
        <p className="text-muted-foreground">Últimas 100 notificações</p>
      </div>
      <Card>
        <CardHeader><CardTitle>{items.length} itens</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem notificações.</p>
          ) : (
            <ul className="divide-y">
              {items.map((it: any) => {
                const unread = !(it.lidaPor ?? []).includes(userId);
                const body = (
                  <div className={"py-3 " + (unread ? "bg-blue-50/40 -mx-2 px-2 rounded" : "")}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {unread && <span className="h-2 w-2 rounded-full bg-primary" />}
                        <p className="font-medium">{it.titulo}</p>
                      </div>
                      <span className="status-badge status-aberto text-[10px]">{it.tipo.replace(/_/g, " ")}</span>
                    </div>
                    {it.descricao && <p className="text-sm text-muted-foreground mt-1">{it.descricao}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{formatDateTime(it.createdAt)}</p>
                  </div>
                );
                return (
                  <li key={String(it._id)}>
                    {it.href ? <Link href={it.href} className="block hover:underline">{body}</Link> : body}
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
