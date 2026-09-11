"use client";

import Link from "next/link";
import { Bell, CheckCheck, Info, PiggyBank, AlertTriangle, XCircle, WalletCards } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { refreshNotifications } from "@/lib/notifications/client-refresh";

type Notification = { id: string; type: string; severity: "info" | "success" | "warning" | "danger"; title: string; message: string; action_href: string | null; created_at: string; read_at: string | null };

const iconFor = (type: string, severity: Notification["severity"]) => {
  if (type === "saving_opportunity") return PiggyBank;
  if (severity === "danger") return XCircle;
  if (severity === "warning") return AlertTriangle;
  if (type === "new_transaction") return WalletCards;
  return Info;
};

export function NotificationBell({ placement = "header" }: { placement?: "header" | "sidebar" }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [popover, setPopover] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const unread = useMemo(() => items.filter(x => !x.read_at).length, [items]);

  async function load() {
    const s = getSupabaseBrowserClient(); if (!s) return;
    const { data: auth } = await s.auth.getUser(); if (!auth.user) return;
    const { data } = await s.from("notifications").select("id,type,severity,title,message,action_href,created_at,read_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }).limit(30);
    setItems((data ?? []) as Notification[]);
  }
  useEffect(() => { void refreshNotifications({ force: true }).then(() => load()); }, []);
  useEffect(() => {
    const s = getSupabaseBrowserClient(); if (!s) return;
    let cancelled = false;
    let channel: ReturnType<typeof s.channel> | null = null;
    s.auth.getUser().then(({ data }) => {
      if (cancelled || !data.user) return;
      const userId = data.user.id;
      channel = s.channel(`notifications-${userId}-${crypto.randomUUID()}`);
      channel.on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => void load());
      channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR") console.warn("[notifications] realtime channel error");
      });
    });
    return () => {
      cancelled = true;
      if (channel) void s.removeChannel(channel);
    };
  }, []);

  async function markRead(id: string) { await fetch("/api/notifications/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }); setItems(xs => xs.map(x => x.id === id ? { ...x, read_at: new Date().toISOString() } : x)); }
  async function markAll() { await fetch("/api/notifications/read-all", { method: "POST" }); setItems(xs => xs.map(x => ({ ...x, read_at: x.read_at ?? new Date().toISOString() }))); }

  function positionPopover() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(window.innerWidth * 0.92, 420);
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width));
    const top = Math.min(window.innerHeight - 120, rect.bottom + 8);
    setPopover({ top, left });
  }

  useEffect(() => {
    if (!open) return;
    positionPopover();
    const onViewportChange = () => positionPopover();
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => { window.removeEventListener("resize", onViewportChange); window.removeEventListener("scroll", onViewportChange, true); };
  }, [open]);

  return <div className={placement === "sidebar" ? "relative w-full" : "relative"}>
    <button ref={triggerRef} type="button" aria-label="Notifications" onClick={() => setOpen(x => { const next = !x; if (next) window.requestAnimationFrame(positionPopover); return next; })} className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-background transition hover:bg-accent">
      <Bell className="h-4 w-4" />
      {unread > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">{unread > 9 ? "9+" : unread}</span>}
    </button>
    {open && <>
      <button aria-label="Fermer les notifications" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
      <div style={{ top: popover.top, left: popover.left }} className="fixed z-[100] w-[min(92vw,420px)] max-w-[calc(100vw-16px)] overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-2xl">
        <div className="flex items-center justify-between border-b px-4 py-3"><div><p className="font-semibold">Notifications</p><p className="text-xs text-muted-foreground">{unread ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est à jour"}</p></div>{unread > 0 && <button onClick={() => void markAll()} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"><CheckCheck className="h-3.5 w-3.5" />Tout lire</button>}</div>
        <div className="max-h-[min(65vh,520px)] overflow-y-auto">
          {!items.length ? <div className="px-4 py-8 text-center text-sm text-muted-foreground">Aucune notification pour le moment.</div> : items.map(n => { const Icon = iconFor(n.type, n.severity); return <div key={n.id} className={cn("border-b p-4 last:border-b-0", !n.read_at && "bg-primary/5")}>
            <div className="flex gap-3"><Icon className={cn("mt-0.5 h-4 w-4 shrink-0", n.severity === "danger" && "text-destructive", n.severity === "warning" && "text-amber-600", n.severity === "success" && "text-emerald-600", n.severity === "info" && "text-primary")} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{n.title}</p>{!n.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{n.message}</p><div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground"><span>{new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(n.created_at))}</span>{!n.read_at && <button onClick={() => void markRead(n.id)} className="font-medium text-primary hover:underline">Marquer lue</button>}{n.action_href && <Link href={n.action_href} onClick={() => { void markRead(n.id); setOpen(false); }} className="font-medium text-primary hover:underline">Ouvrir</Link>}</div></div></div>
          </div> })}
        </div>
      </div>
    </>}
  </div>;
}
