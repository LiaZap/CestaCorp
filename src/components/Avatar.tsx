import { cn } from "@/lib/utils";

const GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-violet-500 to-purple-600",
  "from-cyan-500 to-sky-600",
  "from-lime-500 to-green-600",
  "from-red-500 to-rose-600",
  "from-fuchsia-500 to-pink-600",
  "from-slate-500 to-gray-600",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function iniciais(nome: string): string {
  const limpo = nome.replace(/LTDA|ME|SA|SS|EIRELI|S\.A\.|Ltda\.|\./gi, "").trim();
  const palavras = limpo.split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return "??";
  if (palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase();
  return (palavras[0][0] + palavras[palavras.length - 1][0]).toUpperCase();
}

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
};

export function Avatar({
  name,
  size = "md",
  status,
  className,
  ring = false,
}: {
  name: string;
  size?: keyof typeof SIZES;
  status?: "online" | "offline" | "busy" | null;
  className?: string;
  ring?: boolean;
}) {
  const gradient = GRADIENTS[hashString(name) % GRADIENTS.length];
  const init = iniciais(name);

  return (
    <div className={cn("relative inline-flex shrink-0", className)} role="img" aria-label={`Avatar de ${name}`}>
      <div
        aria-hidden="true"
        className={cn(
          "rounded-full bg-gradient-to-br text-white font-semibold flex items-center justify-center shadow-sm",
          gradient,
          SIZES[size],
          ring && "ring-2 ring-white shadow-md"
        )}
      >
        {init}
      </div>
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-white",
            size === "xs" || size === "sm" ? "h-2 w-2" : "h-3 w-3",
            status === "online" && "bg-emerald-500 animate-pulse",
            status === "busy" && "bg-amber-500",
            status === "offline" && "bg-slate-400"
          )}
        />
      )}
    </div>
  );
}

export function LiveDot({ label = "ao vivo", className }: { label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium", className)}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      {label}
    </span>
  );
}
