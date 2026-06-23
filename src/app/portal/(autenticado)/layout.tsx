import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { LayoutDashboard, FileText, CreditCard, ClipboardList, User, LogOut, Calendar } from "lucide-react";
import { PortalSignOut } from "./PortalSignOut";

const menu = [
  { href: "/portal", icon: LayoutDashboard, label: "Início" },
  { href: "/portal/agenda", icon: Calendar, label: "Agenda" },
  { href: "/portal/cobrancas", icon: CreditCard, label: "Meus boletos" },
  { href: "/portal/documentos", icon: FileText, label: "Documentos" },
  { href: "/portal/formularios", icon: ClipboardList, label: "Formulários" },
  { href: "/portal/meus-dados", icon: User, label: "Meus dados" },
];

export default async function PortalAuthLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || (session.user as any).tipo !== "cliente") redirect("/portal/login");

  const u = session.user as any;

  return (
    <div className="min-h-screen cesta-mesh">
      <header className="bg-white/80 backdrop-blur border-b border-white/60 sticky top-0 z-20">
        <div className="container flex items-center justify-between py-3">
          <Link href="/portal"><Logo size="md" /></Link>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{u.clienteRazaoSocial}</p>
              <p className="text-xs text-muted-foreground">{u.name}</p>
            </div>
            <PortalSignOut />
          </div>
        </div>
        <nav className="container flex gap-1 pb-2 overflow-x-auto">
          {menu.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted text-muted-foreground whitespace-nowrap"
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
}
