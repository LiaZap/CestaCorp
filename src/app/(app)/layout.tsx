import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar, MobileTopBar } from "@/components/Sidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { CommandPalette } from "@/components/CommandPalette";
import { UserMenu } from "@/components/UserMenu";
import { prisma } from "@/lib/db/prisma";

async function getSidebarBadges() {
  const hoje = new Date();
  const fimDoDia = new Date(hoje);
  fimDoDia.setHours(23, 59, 59, 999);
  const mesAtual = hoje.getMonth() + 1; // 1..12
  const anoAtual = hoje.getFullYear();

  // Reajustes (#20): conta clientes ATIVOS cujo mês-aniversário é o atual
  // e que ainda NÃO tiveram um ReajusteHistorico no ano corrente. Não é
  // 1:1 com a tela de propostas (que também depende de índice ter valor),
  // mas é aproximação fiel pro badge: "tem reajuste pendente este mês".
  const [agenda, regua, reajustes] = await Promise.all([
    prisma.eventoAgenda.count({
      where: { status: "PENDENTE", dataVencimento: { lte: fimDoDia } },
    }),
    prisma.execucaoRegua.count({ where: { status: "PENDENTE" } }),
    prisma.cliente.count({
      where: {
        status: "ATIVO",
        mesAniversarioReajuste: mesAtual,
        reajustesHistorico: { none: { ano: anoAtual } },
      },
    }),
  ]);

  return { agenda, regua, reajustes };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [badges, userDados] = await Promise.all([
    getSidebarBadges().catch(() => ({ agenda: 0, regua: 0, reajustes: 0 })),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, role: true, avatarUrl: true },
    }),
  ]);

  return (
    <div className="flex min-h-screen">
      <Sidebar badges={badges} />
      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b px-6 py-3 flex items-center gap-4">
          <div className="lg:hidden">
            <MobileTopBar />
          </div>
          <div className="hidden lg:block flex-1 max-w-lg">
            <CommandPalette />
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <div className="lg:hidden">
              <CommandPalette />
            </div>
            <NotificationBell />
            <UserMenu
              name={userDados?.name ?? session.user.name ?? "Usuário"}
              email={userDados?.email ?? session.user.email ?? ""}
              role={userDados?.role ?? "OPERADOR"}
              avatarUrl={userDados?.avatarUrl}
            />
          </div>
        </header>
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
