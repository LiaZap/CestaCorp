import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Toaster } from "sonner";
import { MobileNav } from "./MobileNav";
import { MobileTopBar } from "./MobileTopBar";

export const dynamic = "force-dynamic";

/**
 * Layout mobile-first — experiência dedicada, não adaptação do desktop.
 * Top bar compacto + conteúdo + bottom tab bar sticky.
 */
export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-lime-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 pb-20">
      <MobileTopBar userName={session.user?.name ?? ""} />
      <main className="px-4 py-4 max-w-md mx-auto space-y-4">
        {children}
      </main>
      <MobileNav />
      <Toaster richColors closeButton position="top-center" />
    </div>
  );
}
