"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { cn, formatDateTime } from "@/lib/utils";

type Item = {
  _id: string;
  tipo: string;
  titulo: string;
  descricao?: string;
  href?: string;
  priority: string;
  lidaPor: string[];
  createdAt: string;
};

const tipoColor: Record<string, string> = {
  FORM_RECEBIDO: "bg-blue-100 text-blue-700",
  COBRANCA_ATRASADA: "bg-red-100 text-red-700",
  COBRANCA_PAGA: "bg-emerald-100 text-emerald-700",
  REGUA_ERRO: "bg-rose-100 text-rose-700",
  REAJUSTE_MES: "bg-amber-100 text-amber-700",
  CLIENTE_PROSPECT: "bg-purple-100 text-purple-700",
  SISTEMA: "bg-muted text-muted-foreground",
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);

  async function carregar() {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    setItems(json.items);
    setUnread(json.unreadCount);
  }

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60_000);
    return () => clearInterval(t);
  }, []);

  async function marcarTodas() {
    await fetch("/api/notifications", { method: "POST" });
    carregar();
  }

  async function abrirItem(item: Item) {
    if (!item.lidaPor.length) {
      await fetch(`/api/notifications/${item._id}/read`, { method: "POST" });
    }
    setOpen(false);
    if (item.href) window.location.href = item.href;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md hover:bg-muted"
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-96 max-h-[32rem] bg-white border rounded-lg shadow-xl overflow-hidden z-40">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold">Notificações</h3>
              {unread > 0 && (
                <button onClick={marcarTodas} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                  <CheckCheck className="h-3 w-3" /> Marcar todas como lidas
                </button>
              )}
            </div>
            <div className="overflow-y-auto max-h-96">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Tudo em dia!</p>
              ) : (
                <ul className="divide-y">
                  {items.map((it) => {
                    const unread = it.lidaPor.length === 0;
                    const Content = (
                      <div className={cn("p-3 flex gap-3 hover:bg-muted/50 cursor-pointer", unread && "bg-blue-50/30")}>
                        <span className={cn("h-2 w-2 rounded-full mt-2 shrink-0", unread ? "bg-primary" : "bg-transparent")} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2 mb-0.5">
                            <span className="text-sm font-medium truncate">{it.titulo}</span>
                            <span className={cn("status-badge text-[10px] shrink-0", tipoColor[it.tipo] ?? "status-aberto")}>
                              {it.tipo.replace(/_/g, " ")}
                            </span>
                          </div>
                          {it.descricao && <p className="text-xs text-muted-foreground">{it.descricao}</p>}
                          <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(it.createdAt)}</p>
                        </div>
                      </div>
                    );
                    return (
                      <li key={it._id} onClick={() => abrirItem(it)}>
                        {Content}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <Link
              href="/notificacoes"
              onClick={() => setOpen(false)}
              className="block text-center text-sm py-3 border-t bg-muted/30 hover:bg-muted transition"
            >
              Ver todas
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
