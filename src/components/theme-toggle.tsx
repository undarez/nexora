"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const next: Theme =
    theme === "light" ? "dark" : theme === "dark" ? "system" : "light";

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      title={`Thème : ${theme}. Cliquer pour ${next}.`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-background/80 shadow-sm transition hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground"
    >
      <Icon className="h-4 w-4" />
      <span className="sr-only">Changer de thème</span>
    </button>
  );
}
