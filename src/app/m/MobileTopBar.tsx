"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Bell, LogOut, Monitor } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Avatar } from "@/components/Avatar";
import { useEffect, useState } from "react";

export function MobileTopBar({ userName }: { userName: string }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/notifications", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (alive) setUnread(j.unreadCount ?? 0);
      } catch {}
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200/60 dark:border-slate-800">
      <div className="px-4 h-14 flex items-center justify-between max-w-md mx-auto">
        <Link href="/m">
          <Logo size="sm" />
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/notificacoes"
            aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ""}`}
            className="relative h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 h-4 min-w-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <Link
            href="/dashboard"
            aria-label="Ir para versão desktop"
            title="Versão desktop"
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted"
          >
            <Monitor className="h-4 w-4" />
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            aria-label="Sair"
            className="h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <Avatar name={userName || "U"} size="sm" />
        </div>
      </div>
    </header>
  );
}
