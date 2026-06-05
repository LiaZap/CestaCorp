"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Menu, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { SIDEBAR_GROUPS, type SidebarBadges } from "./sidebar-items";
import { Logo } from "./Logo";

/**
 * Botão hamburguer mostrado abaixo de lg (#56). Abre Sheet com itens da Sidebar.
 * Sheet fecha automaticamente ao navegar (usePathname change).
 */
export function MobileSidebarTrigger({ badges }: { badges?: SidebarBadges }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            aria-label="Abrir menu"
            className="h-10 w-10 inline-flex items-center justify-center rounded-md hover:bg-muted transition"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <div className="border-b p-5">
            <Logo size="md" />
          </div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-3">
            {SIDEBAR_GROUPS.map((group) => (
              <div key={group.id}>
                <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  {group.title}
                </p>
                <div className="space-y-1">
                  {group.items.map(({ href, icon: Icon, label, badgeKey }) => {
                    const active = pathname === href || pathname.startsWith(href + "/");
                    const count = badgeKey ? badges?.[badgeKey] ?? 0 : 0;
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="flex-1 truncate">{label}</span>
                        {count > 0 && (
                          <span className={cn(
                            "inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-bold",
                            active ? "bg-white/25 text-white" : "bg-blue-100 text-blue-700",
                          )}>
                            {count > 99 ? "99+" : count}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-3 border-t px-5 py-4 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sair
          </button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
