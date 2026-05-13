"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { Avatar } from "./Avatar";
import { User, LogOut, Settings, Shield, ChevronDown } from "lucide-react";

export function UserMenu({
  name,
  email,
  role,
  avatarUrl,
}: {
  name: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const roleLabel = role === "ADMIN" ? "Administrador" : role === "GESTOR" ? "Gestor" : "Operador";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md hover:bg-muted px-2 py-1 transition"
        aria-label="Menu do usuário"
        aria-expanded={open}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={name} className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <Avatar name={name} size="sm" />
        )}
        <div className="text-sm hidden sm:block text-left">
          <p className="font-medium leading-tight">{name}</p>
          <p className="text-xs text-muted-foreground leading-tight">{roleLabel}</p>
        </div>
        <ChevronDown className={"h-3 w-3 text-muted-foreground transition " + (open ? "rotate-180" : "")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border bg-white shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-2 border-b">
            <p className="font-semibold text-sm truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
            <span className="inline-block mt-1 text-[10px] uppercase tracking-wider bg-cestacorp-blue/10 text-cestacorp-blue px-2 py-0.5 rounded-full font-semibold">
              {roleLabel}
            </span>
          </div>

          <Link
            href="/perfil"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <User className="h-4 w-4" /> Meu perfil
          </Link>

          {role === "ADMIN" && (
            <Link
              href="/configuracoes/usuarios"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <Shield className="h-4 w-4" /> Gerenciar equipe
            </Link>
          )}

          <Link
            href="/configuracoes"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <Settings className="h-4 w-4" /> Configurações
          </Link>

          <div className="border-t my-1" />

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-2 w-full text-left px-3 py-2 text-sm hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      )}
    </div>
  );
}
