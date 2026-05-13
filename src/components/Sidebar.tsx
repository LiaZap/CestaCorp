"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, FileText, MessageSquareWarning,
  ClipboardList, Tag, LogOut, Settings, BarChart3, TrendingUp, Calendar, Receipt,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { signOut } from "next-auth/react";

export type SidebarBadges = {
  agenda?: number;       // eventos vencendo hoje/atrasados
  regua?: number;        // execuções pendentes
  reajustes?: number;    // propostas em análise
};

const menu = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", badgeKey: null as null | keyof SidebarBadges },
  { href: "/clientes", icon: Users, label: "Clientes", badgeKey: null },
  { href: "/contratos", icon: FileText, label: "Contratos", badgeKey: null },
  { href: "/notas-fiscais", icon: Receipt, label: "Notas Fiscais", badgeKey: null },
  { href: "/agenda", icon: Calendar, label: "Agenda", badgeKey: "agenda" as const },
  { href: "/regua-cobranca", icon: MessageSquareWarning, label: "Régua de Cobrança", badgeKey: "regua" as const },
  { href: "/reajustes", icon: TrendingUp, label: "Reajustes", badgeKey: "reajustes" as const },
  { href: "/formularios", icon: ClipboardList, label: "Formulários", badgeKey: null },
  { href: "/tags", icon: Tag, label: "Tags", badgeKey: null },
  { href: "/relatorios", icon: BarChart3, label: "Relatórios", badgeKey: null },
  { href: "/configuracoes", icon: Settings, label: "Configurações", badgeKey: null },
];

const LS_KEY = "cestacorp.sidebar.collapsed";

export function Sidebar({ badges }: { badges?: SidebarBadges }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Lê preferência no mount (evita flash de SSR)
  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_KEY);
      if (v === "1") setCollapsed(true);
    } catch {}
    setMounted(true);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(LS_KEY, next ? "1" : "0");
    } catch {}
  }

  return (
    <aside
      className={cn(
        "hidden lg:flex shrink-0 flex-col border-r bg-white sticky top-0 h-screen transition-[width] duration-200 ease-out",
        collapsed ? "w-[68px]" : "w-64"
      )}
      data-collapsed={collapsed}
    >
      <div className={cn(
        "border-b shrink-0 flex items-center relative",
        collapsed ? "p-3 justify-center" : "p-5"
      )}>
        {collapsed ? (
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm"
            style={{ background: "linear-gradient(135deg, #1F4FC4 0%, #84CC16 100%)" }}
            aria-label="Cestacorp"
          >
            C
          </div>
        ) : (
          <Logo size="md" />
        )}
        {mounted && (
          <button
            onClick={toggle}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            className="absolute -right-3 top-6 h-6 w-6 rounded-full bg-white border shadow-sm flex items-center justify-center hover:bg-muted hover:text-cestacorp-blue transition z-10"
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      <nav className={cn("flex-1 space-y-1 overflow-y-auto overflow-x-hidden", collapsed ? "p-2" : "p-3")}>
        {menu.map(({ href, icon: Icon, label, badgeKey }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const count = badgeKey ? badges?.[badgeKey] ?? 0 : 0;
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "group relative flex items-center rounded-md text-sm font-medium transition-colors",
                collapsed ? "justify-center h-10 w-full" : "gap-3 px-3 py-2",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="relative shrink-0">
                <Icon className="h-4 w-4" />
                {/* Ponto indicador de badge quando colapsada */}
                {collapsed && count > 0 && (
                  <span className={cn(
                    "absolute -top-1 -right-1 h-2 w-2 rounded-full ring-2 ring-white",
                    badgeKey === "agenda" ? "bg-red-500"
                    : badgeKey === "regua" ? "bg-amber-500"
                    : "bg-blue-500"
                  )} />
                )}
              </div>

              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{label}</span>
                  {count > 0 && (
                    <span className={cn(
                      "inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold",
                      active
                        ? "bg-white/25 text-white"
                        : badgeKey === "agenda"
                        ? "bg-red-100 text-red-700"
                        : badgeKey === "regua"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                    )}>
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </>
              )}

              {/* Tooltip customizado quando colapsada */}
              {collapsed && (
                <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded-md bg-slate-900 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-50">
                  {label}
                  {count > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-white/20 text-[10px] font-bold">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        title={collapsed ? "Sair" : undefined}
        className={cn(
          "flex items-center border-t text-sm text-muted-foreground hover:bg-muted shrink-0 transition-colors",
          collapsed ? "justify-center py-4" : "gap-3 px-5 py-4"
        )}
      >
        <LogOut className="h-4 w-4" />
        {!collapsed && "Sair"}
      </button>
    </aside>
  );
}

export function MobileTopBar() {
  return <Logo size="sm" />;
}
