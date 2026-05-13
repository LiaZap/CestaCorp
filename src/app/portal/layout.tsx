import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function PortalPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen cesta-mesh">
      <header className="bg-white/70 backdrop-blur border-b border-white/50">
        <div className="container flex items-center justify-between py-4">
          <Link href="/portal"><Logo size="md" /></Link>
          <span className="text-sm text-muted-foreground">Portal do Cliente</span>
        </div>
      </header>
      <main className="container py-8">{children}</main>
      <footer className="text-center py-6 text-xs text-muted-foreground">
        © Cestacorp — Contabilidade que vai além dos números
      </footer>
    </div>
  );
}
