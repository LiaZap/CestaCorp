"use client";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function PortalSignOut() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/portal/login" })}
      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive"
    >
      <LogOut className="h-4 w-4" /> Sair
    </button>
  );
}
