"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, CreditCard, MessageSquare, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SIDEBAR_GROUPS } from "@/components/sidebar-items";

/**
 * 4 tabs principais + 5ª "Mais" abrindo Sheet (#58).
 * As 4 principais ficam estáticas; a Mais expõe TUDO da sidebar pra mobile.
 */
const tabs = [
  { href: "/m", icon: Home, label: "Início" },
  { href: "/m/clientes", icon: Users, label: "Clientes" },
  { href: "/m/cobrancas", icon: CreditCard, label: "Cobranças" },
  { href: "/m/regua", icon: MessageSquare, label: "Régua" },
];

export function MobileNav() {
  const pathname = usePathname();
  const [openMais, setOpenMais] = React.useState(false);

  // Fecha drawer ao navegar
  React.useEffect(() => {
    setOpenMais(false);
  }, [pathname]);

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200/60 dark:border-slate-800"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="max-w-md mx-auto grid grid-cols-5">
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = href === "/m" ? pathname === "/m" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2.5 transition relative",
                  active ? "text-cestacorp-blue dark:text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-b-full bg-cestacorp-blue dark:bg-primary" />
                )}
                <Icon className={cn("h-5 w-5", active && "fill-current/10")} aria-hidden="true" />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            aria-label="Abrir mais opções"
            onClick={() => setOpenMais(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 py-2.5 transition relative w-full",
              "text-muted-foreground hover:text-foreground",
            )}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            <span className="text-[10px] font-medium">Mais</span>
          </button>
        </li>
      </ul>

      <Sheet open={openMais} onOpenChange={setOpenMais}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
          <SheetTitle className="px-2 pt-2">Mais</SheetTitle>
          <div className="p-4 grid grid-cols-3 gap-3">
            {SIDEBAR_GROUPS.flatMap((g) => g.items)
              .filter((it) => !["/dashboard"].includes(it.href))
              .map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex flex-col items-center gap-2 rounded-xl bg-white dark:bg-slate-900 border dark:border-slate-800 p-3 active:scale-[0.96] transition"
                >
                  <div className="h-10 w-10 rounded-full bg-cestacorp-blue/10 text-cestacorp-blue flex items-center justify-center">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="text-[11px] font-medium text-center leading-tight">{label}</span>
                </Link>
              ))}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
