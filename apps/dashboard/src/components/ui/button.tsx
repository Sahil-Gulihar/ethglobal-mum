import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "ink" | "link";
export type ButtonSize = "sm" | "default" | "lg" | "icon";

/* docs/DESIGN.md, Buttons: 36px, radius 6, 14px/500, no shadow, monochrome. */
const base =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-medium select-none transition-[background-color,border-color,color,opacity] duration-150 ease-out disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground hover:opacity-90",
  ink: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "border border-border-default bg-background text-foreground hover:bg-muted",
  outline: "border border-border-default bg-background text-foreground hover:bg-muted",
  ghost: "text-foreground hover:bg-muted",
  destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
  link: "link h-auto px-0 font-medium",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 rounded-md px-3 text-[13px] [&_svg]:size-3.5",
  default: "h-9 rounded-md px-3.5 text-sm max-sm:h-11",
  lg: "h-10 rounded-md px-4 text-sm max-sm:h-11",
  icon: "size-9 rounded-md",
};

export function buttonVariants({ variant = "default", size = "default", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, sizes[size], variants[variant], className);
}

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonVariants({ variant, size, className })} {...props} />;
}
