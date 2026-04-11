import type { HTMLAttributes, ReactNode } from "react";

type SurfaceVariant = "default" | "muted" | "inset" | "glass";

const variantClass: Record<SurfaceVariant, string> = {
  default:
    "border-app-border/90 bg-app-surface/75 shadow-app-soft backdrop-blur-md supports-[backdrop-filter]:bg-app-surface/55",
  muted:
    "border-app-border/70 bg-app-bg-subtle/85 shadow-none backdrop-blur-sm",
  inset:
    "border-app-border/50 bg-app-bg/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm",
  glass:
    "border-app-border/80 bg-app-bg/40 shadow-app-lift backdrop-blur-xl supports-[backdrop-filter]:bg-app-bg/30",
};

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: SurfaceVariant;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClass = {
  none: "",
  sm: "p-4",
  md: "p-5 md:p-6",
  lg: "p-6 md:p-8",
} as const;

export function Surface({
  children,
  className = "",
  variant = "default",
  padding = "md",
  ...rest
}: SurfaceProps) {
  return (
    <div
      className={`rounded-app-xl border transition-[box-shadow,border-color,transform] duration-300 ${variantClass[variant]} ${paddingClass[padding]} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
