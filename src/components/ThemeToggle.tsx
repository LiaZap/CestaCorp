"use client";
import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";

function aplicarTema(tema: Theme) {
  const root = document.documentElement;
  const dark =
    tema === "dark" ||
    (tema === "system" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [tema, setTema] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  // Lê preferência salva no mount
  useEffect(() => {
    const salvo = (localStorage.getItem("theme") as Theme | null) ?? "system";
    setTema(salvo);
    aplicarTema(salvo);
    setMounted(true);
  }, []);

  // Escuta mudanças do sistema quando está em "system"
  useEffect(() => {
    if (tema !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () => aplicarTema("system");
    mql.addEventListener("change", h);
    return () => mql.removeEventListener("change", h);
  }, [tema]);

  function trocar(novo: Theme) {
    setTema(novo);
    localStorage.setItem("theme", novo);
    aplicarTema(novo);
  }

  if (!mounted) {
    // Evita FOUC / mismatch SSR
    return <div className="h-10 w-10" aria-hidden />;
  }

  const opcoes: { value: Theme; Icon: any; label: string }[] = [
    { value: "light", Icon: Sun, label: "Claro" },
    { value: "dark", Icon: Moon, label: "Escuro" },
    { value: "system", Icon: Monitor, label: "Sistema" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="inline-flex items-center gap-0.5 rounded-md border bg-muted/30 p-0.5"
    >
      {opcoes.map(({ value, Icon, label }) => (
        <button
          key={value}
          role="radio"
          aria-checked={tema === value}
          aria-label={`Tema ${label}`}
          title={label}
          onClick={() => trocar(value)}
          className={cn(
            "h-7 w-7 rounded flex items-center justify-center transition",
            tema === value
              ? "bg-white dark:bg-slate-800 text-cestacorp-blue dark:text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}

/**
 * Script inline pra aplicar o tema ANTES do React montar — evita flash de branco.
 * Deve ser inserido no <head>.
 */
export function ThemeScript() {
  const code = `
    (function() {
      try {
        var t = localStorage.getItem('theme') || 'system';
        var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (dark) document.documentElement.classList.add('dark');
      } catch (e) {}
    })();
  `.trim();
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
