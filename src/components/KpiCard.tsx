/**
 * KPI card unificado com drill-down opcional (call 18/05).
 *
 * Patrick (call 18/05): "se eu clico no card de inadimplentes, quero ir direto
 * pra lista filtrada — não dar volta no menu". Por isso `href` é first-class.
 */
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  color?: string;
  href?: string;
}

export function KpiCard({ label, value, sub, icon: Icon, color, href }: KpiCardProps) {
  const inner = (
    <Card
      className={cn(
        "h-full transition",
        href && "hover:border-cestacorp-blue hover:shadow-md cursor-pointer"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
          {label}
        </CardTitle>
        {Icon && <Icon className={cn("h-4 w-4", color)} />}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xl md:text-2xl font-bold">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} aria-label={`Ver detalhes de ${label}`} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}

/**
 * KPI restrito: mostra "🔒 sem permissão" pra operacional (call 18/05).
 * Use no lugar de <KpiCard> quando o dado for sensível (R$ agregados).
 */
export function RestrictedKpi(props: KpiCardProps & { podeVer: boolean }) {
  if (props.podeVer) return <KpiCard {...props} />;
  return (
    <Card className="h-full opacity-70">
      <CardHeader className="flex flex-row items-center justify-between pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
          {props.label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-xl md:text-2xl font-bold text-muted-foreground" aria-label="sem permissão">
          🔒
        </div>
        <div className="text-[11px] text-muted-foreground">sem permissão</div>
      </CardContent>
    </Card>
  );
}
