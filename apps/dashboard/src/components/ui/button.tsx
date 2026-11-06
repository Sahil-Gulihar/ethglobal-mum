import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "ink" | "link";
export type ButtonSize = "sm" | "default" | "lg" | "icon";

/*
 * Stageshow controls: 34px default height (--ss-control), 8px radius, a
 * surface visible at rest, and a filled button that keeps its own color under
 * the pointer (one step of itself, never a gray swap).
 */
const base =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-medium select-none transition-[background-color,color,box-shadow,opacity,transform] duration-150 outline-none active:translate-y-px focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  default:
    "bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.16),0_0_0_1px_rgb(47_73_204),0_1px_2px_rgb(0_0_0/0.12)] hover:bg-[#3350f0]",
  secondary: "bg-secondary text-secondary-foreground hover:bg-black/[0.07]",
  outline: "bg-background text-foreground shadow-button hover:bg-[#fafaf9] [&_svg]:text-icon",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  destructive:
    "bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_0_0_1px_rgb(185_28_28),0_1px_2px_rgb(0_0_0/0.12)] hover:bg-[#c92222]",
  ink: "bg-ink text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(0_0_0/0.16)] hover:bg-[#2a2a2d]",
  link: "text-accent-foreground underline-offset-4 hover:underline",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-7 rounded-md px-2.5 text-xs [&_svg]:size-3.5",
  default: "h-[34px] rounded-md px-3 text-[13px]",
  lg: "h-11 rounded-full px-5 text-sm",
  icon: "size-8 rounded-md",
};

export function buttonVariants({ variant = "default", size = "default", className }: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], variant === "link" && "h-auto px-0", className);
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
