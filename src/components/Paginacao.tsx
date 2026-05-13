import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  page: number;
  totalPages: number;
  baseHref: string;
  /** Extra query params (sem page) — preserva filtros atuais */
  preserve?: Record<string, string | undefined>;
  total?: number;
};

function mkHref(baseHref: string, page: number, preserve?: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  if (preserve) {
    for (const [k, v] of Object.entries(preserve)) {
      if (v) sp.set(k, v);
    }
  }
  sp.set("page", String(page));
  return `${baseHref}?${sp.toString()}`;
}

export function Paginacao({ page, totalPages, baseHref, preserve, total }: Props) {
  if (totalPages <= 1) return null;

  const items: (number | "...")[] = [];
  const windowSize = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - windowSize && i <= page + windowSize)) {
      items.push(i);
    } else if (items[items.length - 1] !== "...") {
      items.push("...");
    }
  }

  return (
    <nav className="flex items-center justify-between flex-wrap gap-3 pt-3 text-sm" aria-label="Paginação">
      <p className="text-muted-foreground">
        Página <b>{page}</b> de <b>{totalPages}</b>
        {total !== undefined && <> · {total} registro{total !== 1 ? "s" : ""}</>}
      </p>
      <div className="flex items-center gap-1">
        {page > 1 ? (
          <Link
            href={mkHref(baseHref, page - 1, preserve)}
            aria-label="Página anterior"
            className="inline-flex items-center gap-1 h-8 px-3 rounded-md border hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 h-8 px-3 rounded-md border opacity-40 cursor-not-allowed">
            <ChevronLeft className="h-4 w-4" /> Anterior
          </span>
        )}
        {items.map((it, idx) =>
          it === "..." ? (
            <span key={`dots-${idx}`} className="px-2 text-muted-foreground">…</span>
          ) : (
            <Link
              key={it}
              href={mkHref(baseHref, it, preserve)}
              aria-current={it === page ? "page" : undefined}
              className={cn(
                "h-8 min-w-8 px-2 rounded-md border flex items-center justify-center text-sm",
                it === page ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
              )}
            >
              {it}
            </Link>
          )
        )}
        {page < totalPages ? (
          <Link
            href={mkHref(baseHref, page + 1, preserve)}
            aria-label="Próxima página"
            className="inline-flex items-center gap-1 h-8 px-3 rounded-md border hover:bg-muted"
          >
            Próxima <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 h-8 px-3 rounded-md border opacity-40 cursor-not-allowed">
            Próxima <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
