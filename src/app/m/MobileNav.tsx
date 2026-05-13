"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, CreditCard, MessageSquare, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/m", icon: Home, label: "Início" },
  { href: "/m/clientes", icon: Users, label: "Clientes" },
  { href: "/m/cobrancas", icon: CreditCard, label: "Cobranças" },
  { href: "/m/regua", icon: MessageSquare, label: "Régua" },
  { href: "/m/agenda", icon: Calendar, label: "Agenda" },
];

export function MobileNav() {
  const pathname = usePathname();

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
                  active ? "text-cestacorp-blue dark:text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-b-full bg-cestacorp-blue dark:bg-primary" />
                )}
                <Icon className={cn("h-5 w-5", active && "fill-current/10")} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
