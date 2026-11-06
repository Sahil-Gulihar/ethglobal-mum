import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "ink" | "link";
export type ButtonSize = "sm" | "default" | "lg" | "icon";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-normal any-pointer-coarse:min-h-11 transition-[background-color,color,border-color,box-shadow,opacity] duration-150 outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  default: "border-[0.5px] border-input bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
  outline: "border-[0.5px] border-input bg-card shadow-xs hover:bg-secondary",
  ghost: "hover:bg-muted",
  destructive: "border-[0.5px] border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/20",
  ink: "bg-ink text-white shadow-sm hover:bg-ink/85",
  link: "text-primary underline-offset-4 hover:underline",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-[30px] rounded-sm px-3 text-xs",
  default: "h-[30px] rounded-sm px-3 text-sm",
  lg: "h-11 rounded-sm px-6 text-base",
  icon: "size-[30px] rounded-sm",
};

export function buttonVariants({ variant = "default", size = "default", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
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
