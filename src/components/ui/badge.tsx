import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type Variant = "default" | "secondary" | "destructive" | "outline";

interface Props extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const styles: Record<Variant, string> = {
  default: "bg-cestacorp-blue text-white",
  secondary: "bg-muted text-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  outline: "border border-muted-foreground/30 text-foreground",
};

export function Badge({ variant = "default", className, ...rest }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        styles[variant],
        className
      )}
      {...rest}
    />
  );
}
