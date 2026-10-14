import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-tt42-accent text-tt42-on-accent hover:brightness-110",
  secondary: "bg-tt42-surface2 text-tt42-text hover:bg-tt42-border/70",
  ghost: "text-tt42-muted hover:bg-tt42-surface2 hover:text-tt42-text",
  danger: "bg-tt42-danger/10 text-tt42-danger hover:bg-tt42-danger/20"
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm"
};

// Also usable on links: <Link className={buttonClass({ variant: "secondary" })} />.
export function buttonClass({
  variant = "secondary",
  size = "md",
  className = ""
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return [
    "inline-flex items-center justify-center rounded-lg font-medium transition",
    "disabled:cursor-not-allowed disabled:opacity-50",
    variantClass[variant],
    sizeClass[size],
    className
  ]
    .filter(Boolean)
    .join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({ variant, size, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...rest} />;
}
