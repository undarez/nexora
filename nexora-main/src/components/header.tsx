"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogIn, LogOut, Menu, WalletCards, User, ShieldCheck, Home, Receipt, PiggyBank, TrendingUp, Landmark, MoreHorizontal, X, LineChart, Bot, Activity, Search, Settings, CircleUserRound, CircleHelp } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Sheet } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const links = [
  ["/dashboard", "Tableau de bord"],
  ["/budget", "Budget"],
  ["/transactions", "Dépenses"],
  ["/banque", "Comptes"],
  ["/patrimoine", "Patrimoine"],
  ["/previsions", "Prévisions"],
  ["/pilotage", "Pilotage"],
  ["/orchestration", "Orchestration IA"],
  ["/use-cases", "IA & Use Cases"],
  ["/runtime", "Runtime LIA"],
  ["/veille", "Veille"],
] as const;

const mobileLinks = [
  ["/dashboard", "Accueil", Home],
  ["/transactions", "Transactions", Receipt],
  ["/budget", "Budget", PiggyBank],
  ["/previsions", "Prévisions", TrendingUp],
  ["/banque", "Comptes", Landmark],
] as const;

const mobileDrawerGroups = [
  { title: "Finance", items: [
    ["/dashboard", "Tableau de bord", Home], ["/transactions", "Transactions", Receipt],
    ["/budget", "Budget", PiggyBank], ["/banque", "Comptes bancaires", Landmark],
    ["/patrimoine", "Patrimoine", WalletCards], ["/previsions", "Prévisions", TrendingUp],
    ["/pilotage", "Pilotage", LineChart],
  ] as const },
  { title: "Intelligence", items: [
    ["/orchestration", "Orchestration IA", Bot], ["/use-cases", "IA & Use Cases", Search],
    ["/runtime", "Runtime LIA", Activity], ["/veille", "Veille", Search],
  ] as const },
] as const;

export function Header() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;
    const loadSession = async () => {
      const { data } = await supabase.auth.getUser();
      if (active) setLoggedIn(Boolean(data.user));
    };
    void loadSession();
    void fetch("/api/auth/context", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((ctx) => { if (active) setIsAdmin(Boolean(ctx?.isAdmin)); })
      .catch(() => {});
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setLoggedIn(Boolean(session?.user));
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/auth?reason=signed_out";
  };

  const isLanding = pathname === "/";
  const visibleLinks = isAdmin ? links : links.filter(([href]) => !["/runtime", "/use-cases", "/veille"].includes(href));
  const visibleMobileDrawerGroups = mobileDrawerGroups.map((group) => ({
    ...group,
    items: group.items.filter(([href]) => isAdmin || !["/runtime", "/use-cases", "/veille"].includes(href)),
  }));
  const currentPage = visibleLinks.find(([href]) => pathname.startsWith(href))?.[1] ?? "Nexora";
  const landingLinks = [["#fonctionnalites", "Fonctionnalités"], ["#cas-concrets", "Cas concrets"], ["#comment-ca-marche", "Comment ça marche"], ["#securite", "Sécurité"]] as const;

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className={cn("items-center", mobile ? "flex flex-col gap-2" : "hidden gap-1 md:flex", !isLanding && "lg:hidden")}>
      {(isLanding ? landingLinks : visibleLinks).map(([href, label]) => (
        <Link
          key={href}
          href={href}
          onClick={() => mobile && setMobileMoreOpen(false)}
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-medium transition-all",
            (pathname === href || (!isLanding && pathname.startsWith(href + "/")))
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );

  return (
    <>
      <header className={cn("app-header sticky top-0 z-40 border-b bg-background/85 backdrop-blur-xl shadow-sm", isLanding && "landing-header")}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href={isLanding ? "/" : "/dashboard"} className="group flex min-w-0 items-center gap-2.5 font-bold tracking-tight">
            <span className="nexora-header-logo" aria-label="NEXORA"><img className="nexora-logo-image nexora-logo-light" src="/nexora-wordmark-light.svg" alt="" aria-hidden="true" /><img className="nexora-logo-image nexora-logo-dark" src="/nexora-wordmark-dark.svg" alt="" aria-hidden="true" /></span>
          </Link>
          {!isLanding && <div className="mobile-page-title" aria-live="polite">{currentPage}</div>}

          <NavLinks />

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {loggedIn && !isLanding && <NotificationBell />}
            {isLanding ? (
              loggedIn ? (
                <Link href="/dashboard" className="hidden rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 md:inline-flex">Ouvrir l’application</Link>
              ) : (
                <div className="hidden items-center gap-2 md:flex">
                  <Link href="/auth" className="rounded-lg border px-3 py-2 text-sm font-semibold transition hover:bg-accent">Se connecter</Link>
                  <Link href="/auth?mode=signup" className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5">Créer un compte</Link>
                </div>
              )
            ) : loggedIn ? (
              <>
                <Link href="/profile" className="hidden items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-accent md:inline-flex"><User className="h-4 w-4" />Profil</Link>
                {isAdmin && <Link href="/admin" className="hidden items-center gap-2 rounded-lg border border-primary/30 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 md:inline-flex"><ShieldCheck className="h-4 w-4" />Admin</Link>}<button type="button" onClick={signOut} className="hidden items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-accent md:inline-flex"><LogOut className="h-4 w-4" />Déconnexion</button>
              </>
            ) : (
              <Link href="/auth" className="hidden rounded-lg border px-3 py-2 text-sm font-medium transition hover:bg-accent md:inline-flex">Connexion</Link>
            )}
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-background shadow-sm transition hover:bg-accent md:hidden"
              onClick={() => setMobileMoreOpen(true)}
              aria-label="Ouvrir le menu de navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>


      <Sheet open={mobileMoreOpen} onOpenChange={setMobileMoreOpen} side="left">
          <div className="mobile-drawer flex h-full flex-col pt-7">
            <div className="mobile-drawer-brand mb-5">
              <div className="flex items-center gap-3">
                <span className="rounded-2xl bg-primary/10 p-2.5"><WalletCards className="h-6 w-6 text-primary" /></span>
                <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Menu</p><h2 className="text-2xl font-black">NEXORA</h2></div>
              </div>
              <p className="mt-3 text-sm leading-5 text-muted-foreground">Toutes les fonctions de l’application, organisées pour une utilisation Android au pouce.</p>
            </div>
            <div className="mobile-drawer-scroll space-y-5">
              {isLanding ? (
                <section>
                  <p className="mobile-drawer-section-title">Navigation</p>
                  <div className="mt-2">
                    <NavLinks mobile />
                  </div>
                </section>
              ) : (
                visibleMobileDrawerGroups.filter(group => group.items.length > 0).map((group, index) => (
                  <section key={`${group.title || "group"}-${index}`}>
                    <p className="mobile-drawer-section-title">{group.title}</p>
                    <div className="mt-2 grid gap-2">
                      {group.items.map(([href,label,Icon], index) => (
                        <Link key={`${href || "nav"}-${index}`} href={href} onClick={() => setMobileMoreOpen(false)} className={cn("mobile-drawer-link", (pathname === href || pathname.startsWith(href + "/")) && "is-active")}>
                          <span className="flex min-w-0 items-center gap-3"><span className="mobile-drawer-icon"><Icon className="h-5 w-5" /></span><span className="truncate">{label}</span></span><span className="text-muted-foreground" aria-hidden>›</span>
                        </Link>
                      ))}
                    </div>
                  </section>
                ))
              )}
              <section>
                <p className="mobile-drawer-section-title">Apparence</p>
                <div className="mt-2 flex items-center justify-between rounded-2xl border bg-background/70 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Mode clair / sombre</p>
                    <p className="text-xs text-muted-foreground">Changer l’apparence de NEXORA</p>
                  </div>
                  <ThemeToggle />
                </div>
              </section>
              <section>
                <p className="mobile-drawer-section-title">Compte</p>
                <div className="mt-2 grid gap-2">
                  {loggedIn && <Link href="/aide" onClick={() => setMobileMoreOpen(false)} className="mobile-drawer-link"><span className="flex items-center gap-3"><span className="mobile-drawer-icon"><CircleHelp className="h-5 w-5" /></span>Aide & Guide</span><span>›</span></Link>}

{loggedIn && (
  <Link
    href="/profile"
    onClick={() => setMobileMoreOpen(false)}
    className="mobile-drawer-link"
  >
    <span className="flex items-center gap-3">
      <span className="mobile-drawer-icon">
        <CircleUserRound className="h-5 w-5" />
      </span>
      Mon profil
    </span>
    <span>›</span>
  </Link>
)}
                  <Link href="/settings" onClick={() => setMobileMoreOpen(false)} className="mobile-drawer-link"><span className="flex items-center gap-3"><span className="mobile-drawer-icon"><Settings className="h-5 w-5" /></span>Paramètres</span><span>›</span></Link>
                  {loggedIn && isAdmin && <Link href="/admin" onClick={() => setMobileMoreOpen(false)} className="mobile-drawer-link"><span className="flex items-center gap-3"><span className="mobile-drawer-icon"><ShieldCheck className="h-5 w-5" /></span>Administration</span><span>›</span></Link>}
                </div>
              </section>
            </div>
            <div className="mt-auto border-t pt-4">
              {!loggedIn ? <Link href="/auth" onClick={() => setMobileMoreOpen(false)} className="mobile-drawer-primary"><LogIn className="h-5 w-5" />Connexion</Link> : <button onClick={signOut} className="mobile-drawer-danger"><LogOut className="h-5 w-5" />Se déconnecter</button>}
            </div>
          </div>
        </Sheet>
    </>
  );
}
