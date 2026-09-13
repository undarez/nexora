"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { MonthlyTransactionsAnalytics, type MonthlyAnalyticsTransaction } from "./monthly-transactions-analytics";
import { classifyTransaction } from "@/lib/finance/transaction-categories";

export function MonthlyTransactionsBridge() {
  const pathname = usePathname();
  const [transactions, setTransactions] = useState<MonthlyAnalyticsTransaction[]>([]);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (pathname !== "/dashboard" && pathname !== "/transactions") return;
    const anchor = pathname === "/dashboard" ? document.querySelector(".nexora-dashboard-topgrid") : document.querySelector(".mobile-filter-card");
    if (!anchor?.parentElement) return;
    const element = document.createElement("div"); element.className = "nexora-monthly-transactions-slot mx-auto w-full max-w-7xl px-4 sm:px-6"; anchor.parentElement.insertBefore(element, anchor.nextSibling); setSlot(element);
    return () => { element.remove(); setSlot(null); };
  }, [pathname]);
  useEffect(() => {
    if (pathname !== "/dashboard" && pathname !== "/transactions") return;
    let cancelled = false;
    const load = async () => {
      await fetch("/api/banking/classify", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
      const supabase = getSupabaseBrowserClient(); if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
      const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1); const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const [bank, manual] = await Promise.all([
        supabase.from("bank_transactions").select("id,amount,booked_at,description,merchant_name,category,provider,external_transaction_id").eq("user_id", user.id).gte("booked_at", start.toISOString()).lt("booked_at", end.toISOString()).order("booked_at", { ascending: false }).limit(1000),
        supabase.from("transactions").select("id,amount,occurred_at,label,categories(name)").eq("user_id", user.id).gte("occurred_at", start.toISOString()).lt("occurred_at", end.toISOString()).order("occurred_at", { ascending: false }).limit(1000),
      ]);
      if (cancelled) return;
      const seen = new Set<string>(); const rows: MonthlyAnalyticsTransaction[] = [];
      for (const tx of bank.data ?? []) {
        const key = tx.provider && tx.external_transaction_id ? `bank:${tx.provider}:${tx.external_transaction_id}` : `bank:fallback:${tx.amount}|${tx.booked_at}|${tx.merchant_name || tx.description || ""}`;
        if (seen.has(key)) continue; seen.add(key);
        rows.push({ id: `bank:${tx.id}`, amount: Number(tx.amount), occurred_at: String(tx.booked_at), label: String(tx.merchant_name || tx.description || "Opération bancaire"), category: String(tx.category || classifyTransaction({ label: tx.merchant_name, description: tx.description, providerCategory: tx.category, amount: Number(tx.amount) }).label) });
      }
      for (const tx of manual.data ?? []) { const category = Array.isArray(tx.categories) ? tx.categories[0] : tx.categories; rows.push({ id: `manual:${tx.id}`, amount: Number(tx.amount), occurred_at: String(tx.occurred_at), label: String(tx.label || "Transaction"), category: category?.name ? String(category.name) : null }); }
      setTransactions(rows.sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at))));
    };
    void load(); const timer = window.setInterval(() => void load(), 60_000); return () => { cancelled = true; window.clearInterval(timer); };
  }, [pathname]);
  useEffect(() => {
    if (pathname !== "/transactions") return;
    let cancelled = false;
    const autoCategorize = async () => {
      const supabase = getSupabaseBrowserClient(); if (!supabase) return; const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
      const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString(); const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      const [categoriesResult, transactionsResult] = await Promise.all([supabase.from("categories").select("id,name,kind").eq("user_id", user.id), supabase.from("transactions").select("id,label,amount,category_id").eq("user_id", user.id).gte("occurred_at", start).lt("occurred_at", end).is("category_id", null).limit(500)]);
      if (cancelled || transactionsResult.error) return; const categories = categoriesResult.data ?? [];
      for (const tx of transactionsResult.data ?? []) {
        const definition = classifyTransaction({ label: tx.label, amount: Number(tx.amount) });
        const existing = categories.find((category: any) => classifyTransaction({ label: category.name, amount: Number(tx.amount) }).key === definition.key); let categoryId = existing?.id ?? null;
        if (!categoryId) { const created = await supabase.from("categories").insert({ user_id: user.id, name: definition.label, kind: Number(tx.amount) < 0 ? "expense" : "income" }).select("id,name,kind").single(); if (!created.error) { categoryId = created.data.id; categories.push(created.data as any); } }
        if (categoryId) await supabase.from("transactions").update({ category_id: categoryId }).eq("id", tx.id).eq("user_id", user.id);
      }
    };
    void autoCategorize(); return () => { cancelled = true; };
  }, [pathname]);
  if (!slot) return null;
  return createPortal(<MonthlyTransactionsAnalytics transactions={transactions} />, slot);
}
