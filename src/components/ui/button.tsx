import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "outline" | "ghost" | "secondary" | "destructive";
type Size = "default" | "sm";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "nexora-button inline-flex items-center justify-center rounded-[10px] font-semibold shadow-none transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        size === "default" && "px-4 py-2 text-sm",
        size === "sm" && "px-3 py-1.5 text-xs",
        variant === "default" &&
          "bg-primary text-primary-foreground hover:-translate-y-0.5 hover:brightness-105",
        variant === "outline" &&
          "border bg-background hover:bg-accent hover:text-accent-foreground",
        variant === "ghost" &&
          "hover:bg-accent hover:text-accent-foreground",
        variant === "secondary" &&
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        variant === "destructive" &&
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        className,
      )}
      {...props}
    />
  );
}