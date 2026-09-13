"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, MessageCircle, Bot, Building2, CalendarCheck2, Home, Landmark, LineChart, PiggyBank, Receipt, Search, Settings, ShieldCheck, TrendingUp, WalletCards, LockKeyhole, CircleHelp, PanelLeftClose, PanelLeftOpen, UserRound, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const groups = [
  { title: "Vue générale", items: [["/dashboard", "Tableau de bord", Home]] as const },
  { title: "Finance", items: [
    ["/entreprise", "Entreprise", Building2],
    ["/transactions", "Transactions", Receipt], ["/budget", "Budget", PiggyBank], ["/banque", "Comptes bancaires", Landmark],
    ["/patrimoine", "Patrimoine", WalletCards], ["/coffre", "Coffre financier", LockKeyhole], ["/previsions", "Prévisions", TrendingUp], ["/pilotage", "Pilotage", LineChart],
  ] as const },
  { title: "Intelligence LIA", items: [
    ["/orchestration", "Orchestration IA", Bot], ["/lia", "Parler à LIA", MessageCircle], ["/use-cases", "IA & Use Cases", Search], ["/veille", "Veille", CalendarCheck2],
  ] as const },
] as const;

export function DesktopSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { setCollapsed(window.localStorage.getItem("nexora.desktopSidebarCollapsed") === "1"); } catch {}
  }, []);

  const toggle = () => setCollapsed((value) => {
    const next = !value;
    try { window.localStorage.setItem("nexora.desktopSidebarCollapsed", next ? "1" : "0"); } catch {}
    return next;
  });

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/auth?reason=signed_out";
  };

  return (
    <aside className={cn("desktop-sidebar", collapsed && "is-collapsed")} aria-label="Navigation principale">
      <div className="flex h-full flex-col">
        <div className="desktop-sidebar-top flex items-center gap-2 px-4 py-5">
        <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-3">
          <span className="nexora-sidebar-logo" aria-label="NEXORA"><img className="nexora-logo-image nexora-logo-light" src="/logo-nexora-light.png" alt="" aria-hidden="true" /><img className="nexora-logo-image nexora-logo-dark" src="/logo-nexora-dark.png" alt="" aria-hidden="true" /></span>
        </Link>
        <button type="button" className="desktop-sidebar-toggle" onClick={toggle} aria-label={collapsed ? "Déployer la navigation" : "Réduire la navigation"} title={collapsed ? "Déployer la navigation" : "Réduire la navigation"}>
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
      </div>
      <div className="px-3 pb-3"><div className="h-px bg-border" /></div>
        <nav className="flex-1 overflow-y-auto px-3 pb-5">
          <section className="mb-5">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Accueil</p>
            <div className="space-y-1">
              <Link href="/" className="desktop-sidebar-link" title="Page d'accueil">
                <Home className="h-[18px] w-[18px] shrink-0" /><span>Page d'accueil</span>
              </Link>
            </div>
          </section>
          {groups.map((group) => { const items = group.items.filter(([href]) => isAdmin || !["/runtime", "/use-cases", "/veille"].includes(href)); if (!items.length) return null; return <section key={group.title} className="mb-5">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{group.title}</p>
            <div className="space-y-1">
              {items.map(([href, label, Icon]) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return <Link key={href} href={href} className={cn("desktop-sidebar-link", active && "is-active")} title={label}>
                  <Icon className="h-[18px] w-[18px] shrink-0" /><span>{label}</span>
                </Link>;
              })}
            </div>
          </section>; })}
          <section className="mb-5">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Compte</p>
            <div className="space-y-1">
              <Link href="/aide" className={cn("desktop-sidebar-link", pathname.startsWith("/aide") && "is-active")} title="Aide & Guide"><CircleHelp className="h-[18px] w-[18px] shrink-0" /><span>Aide & Guide</span></Link>
              <Link href="/profile" className={cn("desktop-sidebar-link", pathname.startsWith("/profile") && "is-active")} title="Mon profil">
                <UserRound className="h-[18px] w-[18px] shrink-0" /><span>Mon profil</span>
              </Link>
              <div className="desktop-sidebar-link cursor-pointer" title="Notifications">
                <NotificationBell placement="sidebar" /><span>Notifications</span>
              </div>
              <button type="button" onClick={signOut} className="desktop-sidebar-link w-full text-left" title="Se déconnecter">
                <LogOut className="h-[18px] w-[18px] shrink-0" /><span>Se déconnecter</span>
              </button>
            </div>
          </section>
          <section className="mb-5">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Système</p>
            <div className="space-y-1">
              {isAdmin && <Link href="/runtime" className={cn("desktop-sidebar-link", pathname.startsWith("/runtime") && "is-active")} title="Runtime LIA"><Activity className="h-[18px] w-[18px]" /><span>Runtime LIA</span></Link>}
              <Link href="/settings" className={cn("desktop-sidebar-link", pathname.startsWith("/settings") && "is-active")} title="Paramètres"><Settings className="h-[18px] w-[18px]" /><span>Paramètres</span></Link>
              {isAdmin && <Link href="/admin" className={cn("desktop-sidebar-link", pathname.startsWith("/admin") && "is-active")} title="Administration"><ShieldCheck className="h-[18px] w-[18px]" /><span>Administration</span></Link>}
            </div>
          </section>
        </nav>
        <div className="border-t px-3 py-3">
  <div className="flex items-center gap-2 rounded-xl border bg-card px-2.5 py-2">
    <img src="/nexora-mark.png" alt="" aria-hidden="true" className="h-7 w-7 rounded-lg" />
    <div className="min-w-0"><p className="text-[10px] font-bold">Nexo</p><p className="truncate text-[8px] text-muted-foreground">Votre compagnon IA</p></div>
  </div>
</div>
      </div>
    </aside>
  );
}
