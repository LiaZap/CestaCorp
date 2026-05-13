import Image from "next/image";
import { cn } from "@/lib/utils";

const DIMS = {
  sm: { w: 110, h: 28 },
  md: { w: 160, h: 40 },
  lg: { w: 240, h: 60 },
};

export function Logo({
  className,
  size = "md",
  variant = "color",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "color" | "white";
}) {
  const { w, h } = DIMS[size];
  const src = variant === "white" ? "/cestacorp-logo-branca.webp" : "/cestacorp-logo.webp";

  return (
    <Image
      src={src}
      alt="Cestacorp"
      width={w}
      height={h}
      priority
      className={cn("object-contain", className)}
    />
  );
}
