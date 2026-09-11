"use client";

import { FinancialCrossDomainSummary } from "@/components/finance/financial-cross-domain-summary";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarDays, Check, Pencil, Plus, RefreshCw, Search, Tag, Trash2, WalletCards, X, Receipt, Download, PiggyBank } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Account = { id: string; name: string; balance: number; currency: string };
type Category = { id: string; name: string; kind: string };
type Tx = { id: string; amount: number; occurred_at: string; label: string; source: string | null; account_id: string; category_id: string | null; categories: { name: string } | null; accounts: { name: string } | null; readOnly?: boolean };
type Envelope = { id: string; name: string; planned: number; spent: number };
type Link = { id: string; transaction_id: string; envelope_key: string; amount: number; period_start: string };
type BankLink = { id: string; bank_transaction_id: string; envelope_key: string; amount: number; period_start: string };
type FixedExpense = { id: string; label: string; sector: string; amount: number; due_day: number | null; recurrence: "monthly" | "one_off"; effective_from: string; effective_until: string | null; is_active: boolean; notes: string | null };
type SavedBudget = { id: string; name: string; period_start: string; income: number; starting_balance: number; safety_reserve: number; extra_expense: number; weeks_remaining: number; envelopes: Envelope[] };


const money = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(v);
const dateInput = (d = new Date()) => { const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return x.toISOString().slice(0, 10); };
const monthStart = (value: string) => `${value.slice(0, 7)}-01`;
const activeFixedForMonth = (e: FixedExpense, month: string) => {
  if (!e.is_active) return false;
  const ym = month.slice(0, 7);
  if (e.recurrence === "one_off") return e.effective_from.slice(0, 7) === ym;
  if (e.effective_from.slice(0, 7) > ym) return false;
  if (e.effective_until && e.effective_until.slice(0, 7) < ym) return false;
  return true;
};
const categoryForSector = (sector: string) => {
  const normalized = normalize(sector);
  if (normalized.includes("abonnement")) return "Abonnements";
  if (normalized.includes("course")) return "Courses";
  if (normalized.includes("transport")) return "Transport";
  if (normalized.includes("sante")) return "Santé";
  if (normalized.includes("logement") || normalized.includes("electricite") || normalized.includes("eau") || normalized.includes("internet")) return "Logement / charges";
  return null;
};
const normalize = (s: string) => s.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const suggestionRules: [string[], string][] = [
  [["course", "supermarche", "leclerc", "carrefour", "auchan", "lidl", "intermarche"], "Courses"],
  [["essence", "carburant", "station", "total", "shell"], "Carburant"],
  [["netflix", "spotify", "prime", "abonnement", "canal"], "Abonnements"],
  [["loisir", "cinema", "restaurant", "bar"], "Loisirs"],
  [["loyer", "rent", "edf", "electricite", "eau", "internet", "orange", "free"], "Logement / charges"],
];
function suggestCategory(label: string, categories: Category[]) {
  const n = normalize(label);
  const rule = suggestionRules.find(([keys]) => keys.some(k => n.includes(k)))?.[1];
  if (!rule) return null;
  return categories.find(c => normalize(c.name) === normalize(rule)) ?? null;
}

export default function Page() {
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [bankLinks, setBankLinks] = useState<BankLink[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [savedBudget, setSavedBudget] = useState<SavedBudget | null>(null);
  const [budgetReloading, setBudgetReloading] = useState(false);
  const [addingFixedId, setAddingFixedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState(dateInput().slice(0, 7));
  const [kind, setKind] = useState<"all" | "expense" | "income">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", amount: "", occurred_at: dateInput(), account_id: "", category_id: "", source: "manuel" });
  const [newCategory, setNewCategory] = useState("");
  const [allocating, setAllocating] = useState<string | null>(null);
  const [allocation, setAllocation] = useState("");
  const [selectedEnvelope, setSelectedEnvelope] = useState("");

  async function load() {
    const s = getSupabaseBrowserClient();
    if (!s) { setLoading(false); setMessage("Supabase non configuré."); return; }
    const { data: auth } = await s.auth.getUser();
    const user = auth.user;
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    setLoading(true);
    const periodStart = `${period}-01`;
    const next = new Date(`${periodStart}T12:00:00`); next.setMonth(next.getMonth() + 1);
    const nextStart = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
    let a = await s.from("accounts").select("id,name,balance,currency").eq("user_id", user.id).order("name");
    if (!a.data?.length && !a.error) {
      await s.from("accounts").insert({ user_id: user.id, name: "Compte principal", kind: "bank", balance: 0, currency: "EUR" });
      a = await s.from("accounts").select("id,name,balance,currency").eq("user_id", user.id).order("name");
    }

    let c = await s.from("categories").select("id,name,kind").eq("user_id", user.id).order("name");
    if (!c.data?.length && !c.error) {
      const defaults = [
        ["Courses", "expense"], ["Logement / charges", "expense"], ["Carburant", "expense"],
        ["Abonnements", "expense"], ["Loisirs", "expense"], ["Santé", "expense"],
        ["Transport", "expense"], ["Salaire", "income"], ["Autres revenus", "income"],
      ];
      await s.from("categories").insert(defaults.map(([name, kind]) => ({ user_id: user.id, name, kind })));
      c = await s.from("categories").select("id,name,kind").eq("user_id", user.id).order("name");
    }

    const [t, l, b, fx, bt, bl] = await Promise.all([
      s.from("transactions").select("id,amount,occurred_at,label,source,account_id,category_id,categories(name),accounts(name)").eq("user_id", user.id).gte("occurred_at", `${periodStart}T00:00:00`).lt("occurred_at", `${nextStart}T00:00:00`).order("occurred_at", { ascending: false }).limit(300),
      s.from("transaction_envelope_links").select("id,transaction_id,envelope_key,amount,period_start").eq("user_id", user.id).eq("period_start", periodStart),
      s.from("budget_scenarios").select("id,name,period_start,income,starting_balance,safety_reserve,extra_expense,weeks_remaining,envelopes").eq("user_id", user.id).eq("period_start", periodStart).maybeSingle(),
      s.from("fixed_expenses").select("id,label,sector,amount,due_day,recurrence,effective_from,effective_until,is_active,notes").eq("user_id", user.id).order("due_day").order("label"),
      s.from("bank_transactions").select("id,amount,booked_at,description,merchant_name,category,account_id,bank_accounts(name)").eq("user_id", user.id).gte("booked_at", periodStart).lt("booked_at", nextStart).order("booked_at", { ascending: false }).limit(500),
      s.from("bank_transaction_envelope_links").select("id,bank_transaction_id,envelope_key,amount,period_start").eq("user_id", user.id).eq("period_start", periodStart),
    ]);
    const err = [a, c, t, l, b, fx, bt, bl].find(x => x.error)?.error;
    if (err) setMessage(`Erreur : ${err.message}`);
    setAccounts((a.data ?? []) as Account[]);
    setCategories((c.data ?? []) as Category[]);

    const transactionRows: Tx[] = (t.data ?? []).map((row) => {
      const category = Array.isArray(row.categories)
        ? row.categories[0] ?? null
        : row.categories ?? null;

      const account = Array.isArray(row.accounts)
        ? row.accounts[0] ?? null
        : row.accounts ?? null;

      return {
        id: row.id,
        amount: Number(row.amount),
        occurred_at: row.occurred_at,
        label: row.label,
        source: row.source ?? null,
        account_id: row.account_id,
        category_id: row.category_id ?? null,
        categories: category ? { name: String(category.name) } : null,
        accounts: account ? { name: String(account.name) } : null,
      };
    });

    const bankRows: Tx[] = (bt.data ?? []).map((row: any) => {
      const bankAccount = Array.isArray(row.bank_accounts) ? row.bank_accounts[0] : row.bank_accounts;
      return {
        id: `bank:${row.id}`, amount: Number(row.amount), occurred_at: String(row.booked_at), label: String(row.merchant_name || row.description || "Opération bancaire"),
        source: "open_banking", account_id: String(row.account_id), category_id: null, categories: row.category ? { name: String(row.category) } : null, accounts: { name: String(bankAccount?.name || "Compte bancaire connecté") }, readOnly: true,
      };
    });
    setTransactions([...transactionRows, ...bankRows].sort((x,y)=>String(y.occurred_at).localeCompare(String(x.occurred_at))));
    setLinks((l.data ?? []) as Link[]); setBankLinks((bl.data ?? []) as BankLink[]);
    setFixedExpenses((fx.data ?? []) as FixedExpense[]);
    setSavedBudget(b.data ? ({ ...b.data, income: Number(b.data.income), starting_balance: Number(b.data.starting_balance), safety_reserve: Number(b.data.safety_reserve), extra_expense: Number(b.data.extra_expense), weeks_remaining: Number(b.data.weeks_remaining), envelopes: Array.isArray(b.data.envelopes) ? b.data.envelopes : [] } as SavedBudget) : null);
    setEnvelopes(
      Array.isArray(b.data?.envelopes)
        ? (b.data.envelopes as Envelope[])
        : [],
    );
    setForm(f => ({ ...f, account_id: f.account_id || (a.data?.[0]?.id ?? "") }));
    setLoading(false);
  }
  useEffect(() => { void load(); }, [period]);
  useEffect(() => { const quick = searchParams.get("quick"); const requestedKind = searchParams.get("kind"); if (requestedKind === "expense" || requestedKind === "income") setKind(requestedKind); if (quick === "expense" || quick === "income") { setShowForm(true); setForm(f => ({ ...f, amount: quick === "expense" ? "-" : "" })); } }, [searchParams]);
  useEffect(() => { const s = getSupabaseBrowserClient(); if (!s || !userId) return; const ch = s.channel(`transactions-live-${userId}`).on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` }, () => void load()).on("postgres_changes", { event: "*", schema: "public", table: "transaction_envelope_links", filter: `user_id=eq.${userId}` }, () => void load()).on("postgres_changes", { event: "*", schema: "public", table: "bank_transactions", filter: `user_id=eq.${userId}` }, () => void load()).on("postgres_changes", { event: "*", schema: "public", table: "bank_transaction_envelope_links", filter: `user_id=eq.${userId}` }, () => void load()).subscribe(); return () => { void s.removeChannel(ch); }; }, [userId, period]);

  const filtered = useMemo(() => transactions.filter(t => {
    const matchesQ = !query || `${t.label} ${t.categories?.name ?? ""} ${t.accounts?.name ?? ""}`.toLocaleLowerCase("fr-FR").includes(query.toLocaleLowerCase("fr-FR"));
    const matchesKind = kind === "all" || (kind === "expense" ? t.amount < 0 : t.amount > 0);
    return matchesQ && matchesKind;
  }), [transactions, query, kind]);
  const totals = useMemo(() => ({ income: transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0), expenses: transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0) }), [transactions]);
  const recurring = useMemo(() => {
    const groups = new Map<string, Tx[]>();
    for (const t of transactions.filter(x => x.amount < 0)) { const key = `${normalize(t.label)}|${Math.round(Math.abs(t.amount) * 100)}`; groups.set(key, [...(groups.get(key) ?? []), t]); }
    return [...groups.values()].filter(x => x.length >= 2).map(x => ({ label: x[0].label, amount: Math.abs(x[0].amount), count: x.length, category: x[0].categories?.name ?? "Non catégorisé" })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [transactions]);

  const visibleFixedExpenses = useMemo(() => fixedExpenses.filter(e => activeFixedForMonth(e, period)), [fixedExpenses, period]);
  const savedBudgetPlanned = useMemo(() => savedBudget?.envelopes.reduce((sum, e) => sum + Math.max(0, Number(e.planned) || 0), 0) ?? 0, [savedBudget]);
  const savedBudgetSpent = useMemo(() => savedBudget?.envelopes.reduce((sum, e) => sum + Math.max(0, Number(e.spent) || 0), 0) ?? 0, [savedBudget]);

  async function reloadSavedBudget() {
    const s = getSupabaseBrowserClient();
    if (!s || !userId) return;
    setBudgetReloading(true);
    const { data, error } = await s.from("budget_scenarios").select("id,name,period_start,income,starting_balance,safety_reserve,extra_expense,weeks_remaining,envelopes").eq("user_id", userId).eq("period_start", monthStart(`${period}-01`)).maybeSingle();
    setBudgetReloading(false);
    if (error) { setMessage(`Récupération du budget impossible : ${error.message}`); return; }
    if (!data) { setMessage(`Aucune sauvegarde de budget pour ${period}.`); setSavedBudget(null); setEnvelopes([]); return; }
    const normalized = { ...data, income: Number(data.income), starting_balance: Number(data.starting_balance), safety_reserve: Number(data.safety_reserve), extra_expense: Number(data.extra_expense), weeks_remaining: Number(data.weeks_remaining), envelopes: Array.isArray(data.envelopes) ? data.envelopes : [] } as SavedBudget;
    setSavedBudget(normalized);
    setEnvelopes(normalized.envelopes);
    setMessage(`✓ Budget sauvegardé récupéré pour ${new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(`${period}-01T12:00:00`))}.`);
  }

  async function addFixedExpenseAsTransaction(expense: FixedExpense) {
    const s = getSupabaseBrowserClient();
    if (!s || !userId || addingFixedId) return;
    const occurredAt = `${period}-${String(Math.min(expense.due_day ?? 1, 28)).padStart(2, "0")}T12:00:00`;
    const existing = transactions.find(t => t.source === "budget_fixed" && normalize(t.label) === normalize(expense.label) && Math.abs(t.amount) === Math.abs(Number(expense.amount)));
    if (existing) { setMessage(`« ${expense.label} » est déjà présente dans les transactions du mois.`); return; }
    const accountId = form.account_id || accounts[0]?.id;
    if (!accountId) { setMessage("Aucun compte disponible pour ajouter cette charge."); return; }
    setAddingFixedId(expense.id); setMessage(null);
    let categoryId: string | null = null;
    const categoryName = categoryForSector(expense.sector);
    if (categoryName) categoryId = categories.find(c => normalize(c.name) === normalize(categoryName))?.id ?? null;
    const { error } = await s.from("transactions").insert({
      user_id: userId,
      account_id: accountId,
      category_id: categoryId,
      amount: -Math.abs(Number(expense.amount)),
      occurred_at: new Date(occurredAt).toISOString(),
      label: expense.label,
      source: "budget_fixed",
    });
    setAddingFixedId(null);
    if (error) { setMessage(`Ajout impossible : ${error.message}`); return; }
    setMessage(`✓ Charge « ${expense.label} » ajoutée aux transactions.`);
    await load();
  }

  async function ensureCategory(): Promise<string | null> {
    const s = getSupabaseBrowserClient(); if (!s || !userId) return null;
    if (form.category_id) return form.category_id;
    if (!newCategory.trim()) return null;
    const { data, error } = await s.from("categories").insert({ user_id: userId, name: newCategory.trim(), kind: form.amount.startsWith("-") ? "expense" : "income" }).select("id,name,kind").single();
    if (error) { setMessage(`Catégorie impossible : ${error.message}`); return null; }
    setCategories(x => [...x, data as Category].sort((a, b) => a.name.localeCompare(b.name))); setNewCategory(""); return data.id;
  }
  async function saveTransaction() {
    const s = getSupabaseBrowserClient(); if (!s || !userId) return;
    const value = Number(form.amount.replace(",", "."));
    if (!form.label.trim() || !Number.isFinite(value) || value === 0 || !form.account_id) { setMessage("Renseigne un libellé, un montant non nul et un compte."); return; }
    const categoryId = await ensureCategory();
    setSaving(true); setMessage(null);
    const payload = { user_id: userId, account_id: form.account_id, category_id: categoryId, amount: value, occurred_at: new Date(`${form.occurred_at}T12:00:00`).toISOString(), label: form.label.trim(), source: form.source || "manuel" };
    const result = editingId
      ? await s.from("transactions").update(payload).eq("id", editingId).eq("user_id", userId).select("id").single()
      : await s.from("transactions").insert(payload).select("id").single();
    if (result.error) { setSaving(false); setMessage(`Enregistrement impossible : ${result.error.message}`); return; }

    const transactionId = result.data?.id ?? editingId;
    if (transactionId && value < 0 && selectedEnvelope) {
      const envelopeAmount = Math.min(Math.abs(value), Math.max(0, Number(envelopes.find(e => e.id === selectedEnvelope)?.planned ?? Math.abs(value))));
      if (envelopeAmount > 0) {
        const linkResult = await s.from("transaction_envelope_links").upsert({ user_id: userId, transaction_id: transactionId, period_start: monthStart(form.occurred_at), envelope_key: selectedEnvelope, amount: envelopeAmount }, { onConflict: "user_id,transaction_id" });
        if (linkResult.error) setMessage(`Transaction enregistrée, mais l'enveloppe n'a pas pu être liée : ${linkResult.error.message}`);
      }
    }
    setSaving(false);
    setMessage(editingId ? "✓ Transaction modifiée et budget synchronisé." : "✓ Transaction ajoutée et budget synchronisé."); resetForm(); await load();
  }
  function resetForm() { setShowForm(false); setEditingId(null); setSelectedEnvelope(""); setForm(f => ({ ...f, label: "", amount: "", occurred_at: dateInput(), category_id: "" })); }
  function edit(t: Tx) { setEditingId(t.id); setSelectedEnvelope(linkFor(t.id)?.envelope_key ?? ""); setShowForm(true); setForm({ label: t.label, amount: String(t.amount), occurred_at: dateInput(new Date(t.occurred_at)), account_id: t.account_id, category_id: t.category_id ?? "", source: t.source ?? "manuel" }); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function remove(t: Tx) { const s = getSupabaseBrowserClient(); if (!s || !userId || !confirm(`Supprimer « ${t.label} » ?`)) return; const { error } = await s.from("transactions").delete().eq("id", t.id).eq("user_id", userId); setMessage(error ? `Suppression impossible : ${error.message}` : "✓ Transaction supprimée."); await load(); }
  async function allocate(t: Tx, envelopeKey: string) {
    const s = getSupabaseBrowserClient(); if (!s || !userId || t.amount >= 0) return;
    const amount = Number(allocation.replace(",", "."));
    if (!envelopeKey || !Number.isFinite(amount) || amount <= 0 || amount > Math.abs(t.amount)) { setMessage("Le montant affecté doit être positif et ne pas dépasser la dépense."); return; }
    setSaving(true);
    const bankTransactionId = t.readOnly ? t.id.replace(/^bank:/, "") : null;
    const result = bankTransactionId
      ? await s.from("bank_transaction_envelope_links").upsert({ user_id: userId, bank_transaction_id: bankTransactionId, period_start: monthStart(t.occurred_at), envelope_key: envelopeKey, amount }, { onConflict: "user_id,bank_transaction_id" })
      : await s.from("transaction_envelope_links").upsert({ user_id: userId, transaction_id: t.id, period_start: monthStart(t.occurred_at), envelope_key: envelopeKey, amount }, { onConflict: "user_id,transaction_id" });
    setSaving(false); setAllocating(null); setAllocation(""); setMessage(result.error ? `Affectation impossible : ${result.error.message}` : "✓ Dépense rattachée à l'enveloppe. Le budget est synchronisé."); await load();
  }
  async function removeAllocation(t: Tx) { const s = getSupabaseBrowserClient(); if (!s || !userId) return; const bankTransactionId = t.readOnly ? t.id.replace(/^bank:/, "") : null; const result = bankTransactionId ? await s.from("bank_transaction_envelope_links").delete().eq("user_id", userId).eq("bank_transaction_id", bankTransactionId) : await s.from("transaction_envelope_links").delete().eq("user_id", userId).eq("transaction_id", t.id); setMessage(result.error ? result.error.message : "✓ Affectation retirée."); await load(); }

  const suggested = suggestCategory(form.label, categories);
  const linkFor = (id: string) => {
    if (id.startsWith("bank:")) return bankLinks.find(x => x.bank_transaction_id === id.slice(5));
    return links.find(x => x.transaction_id === id);
  };
  const envelopeSpent = useMemo(() => {
    const totals = new Map<string, number>();
    for (const link of links) totals.set(link.envelope_key, (totals.get(link.envelope_key) ?? 0) + Math.abs(Number(link.amount)));
    for (const link of bankLinks) totals.set(link.envelope_key, (totals.get(link.envelope_key) ?? 0) + Math.abs(Number(link.amount)));
    return totals;
  }, [links, bankLinks]);
  const budgetTotal = useMemo(() => envelopes.reduce((sum, e) => sum + Math.max(0, Number(e.planned) || 0), 0), [envelopes]);
  const budgetSpent = useMemo(() => [...envelopeSpent.values()].reduce((sum, value) => sum + value, 0), [envelopeSpent]);
  const budgetRemaining = Math.max(0, budgetTotal - budgetSpent);
  return <main className="app-surface-page mx-auto max-w-7xl space-y-6 px-4 py-6 pb-24 sm:px-6 sm:py-8">
  <FinancialCrossDomainSummary month={`${period}-01`} />
    <div className="app-page-hero flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="app-page-kicker">Centre financier</p><h1 className="app-page-title">Transactions</h1><p className="mt-2 max-w-3xl text-sm text-muted-foreground">Chaque opération alimente le budget, les prévisions et les analyses. Une dépense affectée à une enveloppe met automatiquement à jour son « Dépensé ». Les règles de calcul restent déterministes ; l'IA pourra ensuite expliquer les résultats.</p></div><Button onClick={() => { setEditingId(null); setSelectedEnvelope(""); setShowForm(true); }}><Plus className="mr-2 h-4 w-4" />Ajouter une transaction</Button></div>

    <div className="mobile-rail grid gap-4 md:grid-cols-3"><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Revenus du mois</p><p className="financial-number mt-2 text-2xl font-bold text-[var(--success)] dark:text-emerald-400">{money(totals.income)}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Dépenses du mois</p><p className="financial-number mt-2 text-2xl font-bold">{money(totals.expenses)}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Net observé</p><p className={`financial-number mt-2 text-2xl font-bold ${totals.income - totals.expenses < 0 ? "text-red-600 dark:text-red-400" : "text-[var(--success)] dark:text-emerald-400"}`}>{money(totals.income - totals.expenses)}</p></CardContent></Card></div>

    <Card><CardHeader><CardTitle>Budget du mois</CardTitle><p className="text-sm text-muted-foreground">Les enveloppes créées dans Budget sont disponibles ici pour rattacher les dépenses. Une dépense créée depuis Budget est automatiquement présente dans cette liste.</p></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-3"><div><p className="text-xs text-muted-foreground">Enveloppes prévues</p><p className="financial-number mt-1 text-xl font-bold">{money(budgetTotal)}</p></div><div><p className="text-xs text-muted-foreground">Dépenses affectées</p><p className="financial-number mt-1 text-xl font-bold">{money(budgetSpent)}</p></div><div><p className="text-xs text-muted-foreground">Reste budget</p><p className="financial-number mt-1 text-xl font-bold text-[var(--success)] dark:text-emerald-400">{money(budgetRemaining)}</p></div></div>{envelopes.length ? <div className="mt-4 grid gap-2 md:grid-cols-2">{envelopes.map(e => { const spent = envelopeSpent.get(e.id) ?? 0; const planned = Number(e.planned) || 0; const ratio = planned > 0 ? Math.min(spent / planned, 1) : 0; return <div key={e.id} className="rounded-xl border p-3"><div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">{e.name}</span><span className="financial-number">{money(spent)} / {money(planned)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round(ratio * 100)}%` }} /></div></div>; })}</div> : <p className="mt-4 text-sm text-muted-foreground">Aucune enveloppe créée pour ce mois. Crée-les dans Budget puis elles apparaîtront ici.</p>}</CardContent></Card>

    <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle className="flex items-center gap-2"><Download className="h-5 w-5 text-primary" />Budget sauvegardé</CardTitle><p className="text-sm text-muted-foreground">Récupère ici la dernière sauvegarde du Budget pour le mois affiché.</p></div>
            <Button variant="outline" onClick={() => void reloadSavedBudget()} disabled={budgetReloading || !userId}><RefreshCw className={`mr-2 h-4 w-4 ${budgetReloading ? "animate-spin" : ""}`} />{budgetReloading ? "Récupération…" : "Récupérer la sauvegarde"}</Button>
          </div>
        </CardHeader>
        <CardContent>{savedBudget ? <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-4"><div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Revenu prévu</p><p className="mt-1 font-bold">{money(savedBudget.income)}</p></div><div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Solde départ</p><p className="mt-1 font-bold">{money(savedBudget.starting_balance)}</p></div><div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Enveloppes prévues</p><p className="mt-1 font-bold">{money(savedBudgetPlanned)}</p></div><div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Dépensé synchronisé</p><p className="mt-1 font-bold">{money(savedBudgetSpent)}</p></div></div><div className="flex flex-wrap gap-2">{savedBudget.envelopes.map(e => <span key={e.id} className="rounded-full border px-3 py-1 text-xs"><strong>{e.name}</strong> · {money(Number(e.spent) || 0)} / {money(Number(e.planned) || 0)}</span>)}</div></div> : <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Aucune sauvegarde de budget trouvée pour {new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(`${period}-01T12:00:00`))}. Crée ou enregistre le budget depuis la page Budget.</div>}</CardContent>
      </Card>
      <Card className="border-primary/20">
        <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" />Charges enregistrées</CardTitle><p className="text-sm text-muted-foreground">Les charges fixes déclarées dans Budget sont récupérées selon ton profil. Ajoute-les directement comme transactions.</p></CardHeader>
        <CardContent className="space-y-2">{visibleFixedExpenses.length ? visibleFixedExpenses.map(e => { const already = transactions.some(t => t.source === "budget_fixed" && normalize(t.label) === normalize(e.label) && Math.abs(t.amount) === Math.abs(Number(e.amount))); return <div key={e.id} className="flex items-center gap-3 rounded-lg border p-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{e.label}</p><p className="text-xs text-muted-foreground">{e.sector} · {e.recurrence === "monthly" ? "mensuel" : "ponctuel"}{e.due_day ? ` · prélèvement le ${e.due_day}` : ""}</p></div><span className="financial-number text-sm font-bold">-{money(e.amount)}</span><Button size="sm" variant={already ? "outline" : "default"} onClick={() => void addFixedExpenseAsTransaction(e)} disabled={already || addingFixedId === e.id || !!addingFixedId}>{already ? "Déjà ajouté" : addingFixedId === e.id ? "Ajout…" : "Ajouter"}</Button></div> }) : <p className="text-sm text-muted-foreground">Aucune charge active enregistrée pour ce mois. Déclare-les dans Budget pour les retrouver ici.</p>}</CardContent>
      </Card>
    </div>

    <Card className="mobile-filter-card"><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher une opération, catégorie, compte…" className="pl-9" /></label><label className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" /><input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm" /></label><select value={kind} onChange={e => setKind(e.target.value as typeof kind)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="all">Toutes</option><option value="expense">Dépenses</option><option value="income">Revenus</option></select><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Actualiser</Button></div></CardContent></Card>

    {showForm && <Card><CardHeader><div className="flex items-center justify-between"><CardTitle>{editingId ? "Modifier la transaction" : "Nouvelle transaction"}</CardTitle><Button variant="ghost" onClick={resetForm}><X className="h-4 w-4" /></Button></div></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5"><label className="space-y-1 text-sm lg:col-span-2"><span className="font-medium">Libellé</span><Input autoFocus value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Ex. Courses Carrefour" />{suggested && !form.category_id && <button type="button" onClick={() => setForm({ ...form, category_id: suggested.id })} className="text-xs text-primary">Suggestion : utiliser « {suggested.name} »</button>}</label><label className="space-y-1 text-sm"><span className="font-medium">Montant</span><Input type="text" inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="-38,50" /><span className="text-xs text-muted-foreground">Dépense = négatif · revenu = positif</span></label><label className="space-y-1 text-sm"><span className="font-medium">Date de l'opération</span><Input type="date" value={form.occurred_at} onChange={e => setForm({ ...form, occurred_at: e.target.value })} /><span className="text-xs text-muted-foreground">Mois sélectionné : {new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(`${period}-01T12:00:00`))}</span></label><label className="space-y-1 text-sm"><span className="font-medium">Compte</span><select value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">Choisir…</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label></div><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="space-y-1 text-sm"><span className="font-medium">Catégorie</span><select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">Non catégorisée</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="space-y-1 text-sm"><span className="font-medium">Créer une catégorie (optionnel)</span><Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Ex. Animaux" /></label><label className="space-y-1 text-sm"><span className="font-medium">Enveloppe budget</span><select value={selectedEnvelope} onChange={e => setSelectedEnvelope(e.target.value)} disabled={!form.amount.startsWith("-")} className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"><option value="">Aucune affectation</option>{envelopes.map(e => <option key={e.id} value={e.id}>{e.name} · reste {money(Math.max((Number(e.planned) || 0) - (envelopeSpent.get(e.id) ?? 0), 0))}</option>)}</select><span className="text-xs text-muted-foreground">Toutes les enveloppes du budget du mois sont disponibles ici. Une dépense négative peut être rattachée à l’enveloppe choisie.</span></label></div><div className="mt-4 flex flex-wrap gap-3"><Button onClick={() => void saveTransaction()} disabled={saving}>{saving ? "Enregistrement…" : <><Check className="mr-2 h-4 w-4" />Enregistrer</>}</Button><Button variant="outline" onClick={resetForm}>Annuler</Button></div></CardContent></Card>}

    <Card><CardHeader><CardTitle>Opérations de {new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(`${period}-01T12:00:00`))}</CardTitle></CardHeader><CardContent>{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Chargement…</p> : !filtered.length ? <div className="py-10 text-center text-sm text-muted-foreground">Aucune transaction pour cette sélection.</div> : <div className="space-y-2">{filtered.map(t => { const link = t.readOnly ? null : linkFor(t.id); return <div key={t.id} className="mobile-transaction-card rounded-xl border p-4"><div className="grid gap-3 md:grid-cols-[1fr_130px_130px_auto] md:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><span className="rounded-md border p-1.5">{t.amount < 0 ? <ArrowDownLeft className="h-4 w-4 text-red-600" /> : <ArrowUpRight className="h-4 w-4 text-[var(--success)]" />}</span><div className="min-w-0"><p className="truncate font-semibold">{t.label}</p><p className="text-xs text-muted-foreground">{new Date(t.occurred_at).toLocaleDateString("fr-FR")} · {t.accounts?.name ?? "Compte inconnu"} · {t.categories?.name ?? "Non catégorisée"}</p></div></div></div><p className={`financial-number text-lg font-bold md:text-right ${t.amount < 0 ? "" : "text-[var(--success)] dark:text-emerald-400"}`}>{t.amount > 0 ? "+" : ""}{money(t.amount)}</p><div>{t.amount < 0 && !t.readOnly && (link ? <button type="button" onClick={() => void removeAllocation(t)} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs hover:bg-accent"><Tag className="h-3 w-3" />{envelopes.find(e => e.id === link.envelope_key)?.name ?? link.envelope_key} · {money(link.amount)}</button> : <button type="button" onClick={() => { setAllocating(t.id); setAllocation(String(Math.abs(t.amount))); }} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"><WalletCards className="h-3 w-3" />Affecter à une enveloppe</button>)}</div><div className="mobile-transaction-actions flex gap-1 md:justify-end">{t.readOnly ? <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">Banque · lecture seule</span> : <><Button variant="ghost" onClick={() => edit(t)} title="Modifier"><Pencil className="h-4 w-4" /></Button><Button variant="ghost" onClick={() => void remove(t)} title="Supprimer" className="text-red-600"><Trash2 className="h-4 w-4" /></Button></>}</div></div>{allocating === t.id && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-3"><select id={`envelope-${t.id}`} className="h-9 rounded-lg border border-border bg-background px-2 text-sm"><option value="">Choisir une enveloppe…</option>{envelopes.map(e => <option key={e.id} value={e.id}>{e.name} · reste {money(Math.max(e.planned - e.spent, 0))}</option>)}</select><Input className="h-9 w-28" inputMode="decimal" value={allocation} onChange={e => setAllocation(e.target.value)} placeholder="Montant" /><Button onClick={() => { const el = document.getElementById(`envelope-${t.id}`) as HTMLSelectElement | null; if (el?.value) void allocate(t, el.value); }} disabled={saving}>Affecter</Button><Button variant="outline" onClick={() => setAllocating(null)}><X className="h-4 w-4" /></Button><span className="text-xs text-muted-foreground">L'affectation reste inférieure ou égale à la transaction.</span></div>}</div>; })}</div>}</CardContent></Card>

    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" />Dépenses potentiellement récurrentes</CardTitle></CardHeader><CardContent>{recurring.length ? <div className="space-y-2">{recurring.map(r => <div key={r.label+r.amount} className="flex items-center justify-between gap-4 rounded-lg border p-3"><div><p className="text-sm font-semibold">{r.label}</p><p className="text-xs text-muted-foreground">{r.category} · observé {r.count} fois</p></div><span className="financial-number text-sm font-bold">{money(r.amount)}</span></div>)}</div> : <p className="text-sm text-muted-foreground">Pas encore assez d'historique pour détecter une récurrence. Deux opérations similaires suffisent pour faire apparaître une piste.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-primary" />Qualité & prochaines analyses</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><p>Les transactions sont traitées comme des faits observés. Une catégorie suggérée reste modifiable par toi.</p><p>Les dépenses affectées à une enveloppe alimentent maintenant automatiquement son montant « Dépensé » ; un ajustement manuel reste séparé pour éviter tout double comptage.</p><p>La même donnée alimente ensuite la dérive budgétaire et les prévisions.</p></CardContent></Card></div>
  </main>;
}
