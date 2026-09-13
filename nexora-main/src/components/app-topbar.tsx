"use client";

import Link from "next/link";
import { Bell, Search, ChevronDown, Sun } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function AppTopbar({ displayName, email }: { displayName?: string | null; email?: string | null }) {
  const name = displayName?.trim() || email?.split("@")[0] || "Utilisateur";
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "N";

  return (
    <header className="nexora-app-topbar" aria-label="Barre d’application">
      <div className="nexora-topbar-search">
        <Search className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        <input aria-label="Rechercher" placeholder="Rechercher une transaction, un compte, un budget…" />
        <kbd>⌘ K</kbd>
      </div>
      <div className="nexora-topbar-actions">
        <ThemeToggle />
        <NotificationBell />
        <Link href="/profile" className="nexora-user-chip" aria-label="Ouvrir mon profil">
          <span className="nexora-user-avatar">{initials}</span>
          <span className="hidden xl:block min-w-0 text-left">
            <strong className="block truncate">Bonjour, {name}</strong>
            <small>Particulier</small>
          </span>
          <ChevronDown className="hidden h-4 w-4 xl:block" />
        </Link>
      </div>
    </header>
  );
}
