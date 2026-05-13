import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  cta?: { href: string; label: string };
  secondary?: { href: string; label: string };
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, cta, secondary, className }: Props) {
  return (
    <div className={cn("text-center py-10 md:py-14 px-6", className)}>
      {Icon && (
        <div className="mx-auto mb-5 h-16 w-16 rounded-2xl bg-gradient-to-br from-cestacorp-blue/10 to-cestacorp-green/10 flex items-center justify-center">
          <Icon className="h-8 w-8 text-cestacorp-blue" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{description}</p>}
      {(cta || secondary) && (
        <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
          {cta && (
            <Link
              href={cta.href}
              className="inline-flex items-center gap-1 h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
            >
              {cta.label}
            </Link>
          )}
          {secondary && (
            <Link
              href={secondary.href}
              className="inline-flex items-center gap-1 h-10 px-5 rounded-md border text-sm font-medium hover:bg-muted"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
