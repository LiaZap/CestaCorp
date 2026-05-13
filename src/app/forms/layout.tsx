import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Phone, Mail, ShieldCheck } from "lucide-react";

export default function PublicFormsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen cesta-mesh flex flex-col">
      <header className="bg-white/70 backdrop-blur border-b border-white/50 sticky top-0 z-20">
        <div className="container flex items-center justify-between py-4">
          <Link href="/forms" className="flex items-center">
            <Logo size="md" />
          </Link>
          <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
            <a href="https://cestacorp.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-cestacorp-blue">
              cestacorp.com.br
            </a>
            <span className="h-4 w-px bg-border" />
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-cestacorp-green" />
              Dados protegidos pela LGPD
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-8 md:py-12">{children}</main>

      <footer className="border-t bg-white/50 backdrop-blur">
        <div className="container py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="text-xs">© Cestacorp — Contabilidade que vai além dos números</span>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> Suporte via WhatsApp</span>
            <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> contato@cestacorp.com.br</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
