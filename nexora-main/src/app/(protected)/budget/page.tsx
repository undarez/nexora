"use client";

import { FinancialCrossDomainSummary } from "@/components/finance/financial-cross-domain-summary";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight, CirclePlus, Plus, Check, X, Euro, Home,
  Lightbulb, Pencil, Receipt, Save, ShieldCheck, Trash2, WalletCards,
  Wifi, Car, HeartPulse, Smartphone, GraduationCap, ShoppingCart,
  Tv, Landmark, MoreHorizontal
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/finance/progress-bar";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Envelope = { id: string; name: string; planned: number; spent: number; manual_spent?: number };
type FixedExpense = {
  id: string; label: string; sector: string; icon: string; amount: number;
  due_day: number | null; recurrence: "monthly" | "one_off";
  effective_from: string; effective_until: string | null; is_active: boolean; notes: string | null;
};
type ScenarioRow = {
  id: string; period_start: string; name: string; income: number;
  starting_balance: number; safety_reserve: number; extra_expense: number;
  weeks_remaining: number; envelopes: Envelope[];
};

const SECTORS = [
  ["Logement", "home"], ["Électricité", "lightbulb"], ["Eau", "droplets"],
  ["Internet / mobile", "wifi"], ["Assurances", "shield"], ["Crédit", "landmark"],
  ["Transport", "car"], ["Santé", "heart"], ["Abonnements", "tv"],
  ["Impôts / taxes", "receipt"], ["Famille", "users"], ["Courses", "cart"], ["Autres", "wallet"]
] as const;

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  home: Home, lightbulb: Lightbulb, wifi: Wifi, car: Car, heart: HeartPulse,
  tv: Tv, receipt: Receipt, landmark: Landmark, cart: ShoppingCart,
  wallet: WalletCards, shield: ShieldCheck, users: GraduationCap, droplets: Euro
};

const fallbackEnvelopes: Envelope[] = [
  { id: "courses", name: "Courses", planned: 173, spent: 128 },
  { id: "carburant", name: "Carburant", planned: 165, spent: 90 },
  { id: "loisirs", name: "Loisirs", planned: 50, spent: 42 },
  { id: "imprevus", name: "Imprévus", planned: 50, spent: 0 },
];

const money = (v: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(v);
const isoMonth = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
const monthLabel = (value: string) => new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`));
const addMonth = (value: string, delta: number) => {
  const d = new Date(`${value}T12:00:00`); d.setMonth(d.getMonth() + delta);
  return isoMonth(d);
};
const daysInMonth = (value: string) => {
  const d = new Date(`${value}T12:00:00`); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};
const activeForMonth = (e: FixedExpense, month: string) => {
  if (!e.is_active) return false;
  const ym = month.slice(0, 7);
  if (e.recurrence === "one_off") return e.effective_from.slice(0, 7) === ym;
  if (e.effective_from.slice(0, 7) > ym) return false;
  if (e.effective_until && e.effective_until.slice(0, 7) < ym) return false;
  return true;
};

export default function Page() {
  const [month, setMonth] = useState(isoMonth());
  const [envelopes, setEnvelopes] = useState<Envelope[]>(fallbackEnvelopes);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [income, setIncome] = useState(1730);
  const [startingBalance, setStartingBalance] = useState(-115);
  const [safetyReserve, setSafetyReserve] = useState(100);
  const [extraExpense, setExtraExpense] = useState(0);
  const [weeksRemaining, setWeeksRemaining] = useState(4);
  const [newEnvelope, setNewEnvelope] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Chargement…");
  const [userId, setUserId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [additionTarget, setAdditionTarget] = useState<{ id: string; field: "planned" | "spent" } | null>(null);
  const [additionValue, setAdditionValue] = useState("");
  const [addingEnvelopeExpenseId, setAddingEnvelopeExpenseId] = useState<string | null>(null);
  const [expenseDraft, setExpenseDraft] = useState({ label: "", sector: "Logement", amount: "", due_day: "1", recurrence: "monthly" as "monthly" | "one_off", effective_from: isoMonth(), effective_until: "", notes: "" });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleFixed = useMemo(() => fixedExpenses.filter(e => activeForMonth(e, month)), [fixedExpenses, month]);
  const fixedTotal = useMemo(() => visibleFixed.reduce((s, e) => s + e.amount, 0), [visibleFixed]);

  const simulation = useMemo(() => {
    const planned = envelopes.reduce((s, e) => s + Math.max(e.planned, 0), 0);
    const spent = envelopes.reduce((s, e) => s + Math.max(e.spent, 0), 0);
    const remaining = envelopes.reduce((s, e) => s + Math.max(e.planned - e.spent, 0), 0);
    const projectedEnd = startingBalance + income - fixedTotal - remaining - extraExpense;
    const margin = projectedEnd - safetyReserve;
    return {
      planned, spent, remaining, projectedEnd, margin,
      weeklyBudget: Math.max(margin / Math.max(weeksRemaining, 1), 0),
      status: projectedEnd < 0 || margin < 0 ? "danger" : margin < 100 ? "warning" : "safe"
    };
  }, [envelopes, income, startingBalance, fixedTotal, safetyReserve, extraExpense, weeksRemaining]);

  async function getUser() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  }

  async function loadMonth(targetMonth = month, knownUserId = userId) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setLoading(false); setMessage("Supabase non configuré."); return; }
    const user = knownUserId ? { id: knownUserId } : await getUser();
    if (!user) { setLoading(false); setMessage("Connecte-toi pour sauvegarder le budget."); return; }
    setUserId(user.id);
    setLoading(true);
    const [scenarioRes, fixedRes, linksRes] = await Promise.all([
      supabase.from("budget_scenarios").select("id,period_start,name,income,starting_balance,safety_reserve,extra_expense,weeks_remaining,envelopes").eq("user_id", user.id).eq("period_start", targetMonth).maybeSingle(),
      supabase.from("fixed_expenses").select("*").eq("user_id", user.id).order("sector").order("label"),
      supabase.from("transaction_envelope_links").select("envelope_key,amount,transaction_id").eq("user_id", user.id).eq("period_start", targetMonth),
    ]);
    if (scenarioRes.error || fixedRes.error || linksRes.error) {
      setMessage(`Erreur de chargement : ${scenarioRes.error?.message || fixedRes.error?.message}`);
      setLoading(false); return;
    }
    const s = scenarioRes.data as ScenarioRow | null;
    const baseEnvelopes: Envelope[] = s && Array.isArray(s.envelopes) ? s.envelopes : fallbackEnvelopes;
    if (s) {
      setIncome(Number(s.income)); setStartingBalance(Number(s.starting_balance));
      setSafetyReserve(Number(s.safety_reserve)); setExtraExpense(Number(s.extra_expense));
      setWeeksRemaining(Number(s.weeks_remaining));
    } else {
      setIncome(1730); setStartingBalance(-115); setSafetyReserve(100); setExtraExpense(0); setWeeksRemaining(4);
    }
    const linkedSpent = new Map<string, number>();
    for (const link of linksRes.data ?? []) linkedSpent.set(link.envelope_key, (linkedSpent.get(link.envelope_key) ?? 0) + Math.abs(Number(link.amount) || 0));
    setEnvelopes(baseEnvelopes.map(e => ({ ...e, spent: (linkedSpent.get(e.id) ?? 0) + Number(e.manual_spent ?? 0) })));
    setFixedExpenses((fixedRes.data ?? []) as FixedExpense[]);
    setMessage(s ? `Scénario chargé pour ${monthLabel(targetMonth)} — dépenses réelles synchronisées.` : `Nouveau scénario pour ${monthLabel(targetMonth)} — il sera créé à la première modification.`);
    setLoading(false);
  }

  useEffect(() => {
    void loadMonth();
  }, [month]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  // Realtime : une modification depuis le dashboard ou un autre onglet recharge le mois.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient(); if (!supabase || !userId) return;
    let cancelled = false;
    const channel = supabase.channel(`budget-live-${userId}-${month}-${crypto.randomUUID()}`);
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_scenarios", filter: `user_id=eq.${userId}` }, () => { if (!cancelled) void loadMonth(month, userId); })
      .on("postgres_changes", { event: "*", schema: "public", table: "fixed_expenses", filter: `user_id=eq.${userId}` }, () => { if (!cancelled) void loadMonth(month, userId); })
      .on("postgres_changes", { event: "*", schema: "public", table: "transaction_envelope_links", filter: `user_id=eq.${userId}` }, () => { if (!cancelled) void loadMonth(month, userId); })
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` }, () => { if (!cancelled) void loadMonth(month, userId); });
    if (!cancelled) channel.subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId, month]);

  async function persistScenario(overrides?: Partial<ScenarioRow>) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !userId) return;
    setSaving(true);
    const payload = {
      user_id: userId, period_start: month, name: `Budget ${monthLabel(month)}`,
      income: overrides?.income ?? income, starting_balance: overrides?.starting_balance ?? startingBalance,
      safety_reserve: overrides?.safety_reserve ?? safetyReserve, extra_expense: overrides?.extra_expense ?? extraExpense,
      weeks_remaining: overrides?.weeks_remaining ?? weeksRemaining, envelopes: overrides?.envelopes ?? envelopes
    };
    const { error } = await supabase.from("budget_scenarios").upsert(payload, { onConflict: "user_id,period_start" });
    setSaving(false);
    setMessage(error ? `Sauvegarde impossible : ${error.message}` : `✓ Sauvegardé — ${monthLabel(month)}`);
  }

  function scheduleSave(next?: Partial<ScenarioRow>) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void persistScenario(next); }, 500);
  }
  function changeNumber(kind: "income" | "startingBalance" | "safetyReserve" | "extraExpense" | "weeksRemaining", value: number) {
    const setters = { income: setIncome, startingBalance: setStartingBalance, safetyReserve: setSafetyReserve, extraExpense: setExtraExpense, weeksRemaining: setWeeksRemaining };
    const columns = { income: "income", startingBalance: "starting_balance", safetyReserve: "safety_reserve", extraExpense: "extra_expense", weeksRemaining: "weeks_remaining" } as const;
    setters[kind](value); scheduleSave({ [columns[kind]]: value } as Partial<ScenarioRow>);
  }
  function updateEnvelope(
    id: string,
    field: "name" | "planned" | "spent",
    value: string,
  ) {
    const next = envelopes.map((e) => {
      if (e.id !== id) return e;

      if (field === "name") {
        return { ...e, name: value };
      }

      const numericValue = Math.max(
        0,
        Number(value.replace(",", ".")) || 0,
      );

      return {
        ...e,
        [field]: numericValue,
      };
    });

    setEnvelopes(next);
    scheduleSave({ envelopes: next });
  }
  function addEnvelope() {
    const name = newEnvelope.trim(); if (!name) return;
    const next = [...envelopes, { id: crypto.randomUUID(), name, planned: 0, spent: 0 }];
    setEnvelopes(next);
    setNewEnvelope(""); scheduleSave({ envelopes: next });
  }
  function removeEnvelope(id: string) {
    const next = envelopes.filter(e => e.id !== id);
    setEnvelopes(next); scheduleSave({ envelopes: next });
  }

  function openEnvelopeAddition(id: string, field: "planned" | "spent") {
    setAdditionTarget({ id, field });
    setAdditionValue("");
  }

  function cancelEnvelopeAddition() {
    setAdditionTarget(null);
    setAdditionValue("");
  }

  async function applyEnvelopeAddition() {
    if (!additionTarget) return;
    const amount = Number(additionValue.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return;

    const target = envelopes.find(e => e.id === additionTarget.id);
    if (!target) return;

    // Un clic sur + dans « Dépensé » représente une vraie dépense.
    // Elle doit donc exister dans Transactions ET alimenter l'enveloppe via le lien.
    if (additionTarget.field === "spent") {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !userId) return;
      setAddingEnvelopeExpenseId(target.id);
      setSaving(true);

      let accountId: string | null = null;
      const accountResult = await supabase
        .from("accounts")
        .select("id")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (accountResult.error) {
        setMessage(`Impossible de récupérer le compte : ${accountResult.error.message}`);
        setSaving(false);
        setAddingEnvelopeExpenseId(null);
        return;
      }
      accountId = accountResult.data?.id ?? null;

      if (!accountId) {
        const created = await supabase
          .from("accounts")
          .insert({ user_id: userId, name: "Compte principal", kind: "bank", balance: 0, currency: "EUR" })
          .select("id")
          .single();
        if (created.error) {
          setMessage(`Impossible de créer le compte principal : ${created.error.message}`);
          setSaving(false);
          setAddingEnvelopeExpenseId(null);
          return;
        }
        accountId = created.data.id;
      }

      // On utilise le 1er jour du mois pour une date stable : la dépense saisie
      // depuis Budget appartient toujours au mois sélectionné.
      const stableOccurredAt = `${month.slice(0, 7)}-01T12:00:00`;
      const transactionLabel = `Budget · ${target.name}`;

      const duplicate = await supabase
        .from("transactions")
        .select("id")
        .eq("user_id", userId)
        .eq("source", "budget_envelope")
        .eq("label", transactionLabel)
        .eq("amount", -Math.abs(amount))
        .gte("occurred_at", `${month.slice(0, 7)}-01T00:00:00`)
        .lt("occurred_at", `${addMonth(month, 1)}T00:00:00`)
        .limit(1);

      if (duplicate.error) {
        setMessage(`Vérification impossible : ${duplicate.error.message}`);
        setSaving(false);
        setAddingEnvelopeExpenseId(null);
        return;
      }
      if (duplicate.data?.length) {
        setMessage(`Cette dépense existe déjà dans Transactions pour ${target.name}.`);
        setSaving(false);
        setAddingEnvelopeExpenseId(null);
        cancelEnvelopeAddition();
        return;
      }

      const transactionResult = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          account_id: accountId,
          category_id: null,
          amount: -Math.abs(amount),
          occurred_at: new Date(stableOccurredAt).toISOString(),
          label: transactionLabel,
          source: "budget_envelope",
        })
        .select("id")
        .single();

      if (transactionResult.error || !transactionResult.data?.id) {
        setMessage(`Dépense non ajoutée : ${transactionResult.error?.message ?? "erreur inconnue"}`);
        setSaving(false);
        setAddingEnvelopeExpenseId(null);
        return;
      }

      const linkResult = await supabase.from("transaction_envelope_links").upsert({
        user_id: userId,
        transaction_id: transactionResult.data.id,
        period_start: month,
        envelope_key: target.id,
        amount: Math.abs(amount),
      }, { onConflict: "user_id,transaction_id" });

      if (linkResult.error) {
        await supabase.from("transactions").delete().eq("id", transactionResult.data.id).eq("user_id", userId);
        setMessage(`La transaction n'a pas été conservée car le lien avec l'enveloppe a échoué : ${linkResult.error.message}`);
        setSaving(false);
        setAddingEnvelopeExpenseId(null);
        return;
      }

      setSaving(false);
      setAddingEnvelopeExpenseId(null);
      setMessage(`✓ ${money(amount)} € ajoutés à « ${target.name} » et enregistrés dans Transactions.`);
      cancelEnvelopeAddition();
      await loadMonth(month, userId);
      return;
    }

    const next = envelopes.map(e => e.id === target.id
      ? { ...e, planned: Math.max(0, e.planned + amount) }
      : e
    );
    setEnvelopes(next);
    scheduleSave({ envelopes: next });
    cancelEnvelopeAddition();
  }

  function resetDraft() {
    setEditingId(null);
    setExpenseDraft({ label: "", sector: "Logement", amount: "", due_day: "1", recurrence: "monthly", effective_from: month, effective_until: "", notes: "" });
  }
  function editExpense(e: FixedExpense) {
    setEditingId(e.id);
    setExpenseDraft({ label: e.label, sector: e.sector, amount: String(e.amount), due_day: String(e.due_day ?? 1), recurrence: e.recurrence, effective_from: e.effective_from, effective_until: e.effective_until ?? "", notes: e.notes ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function saveFixedExpense() {
    const supabase = getSupabaseBrowserClient(); if (!supabase || !userId) return;
    const amount = Number(expenseDraft.amount.replace(",", "."));
    if (!expenseDraft.label.trim() || !Number.isFinite(amount) || amount < 0) { setMessage("Renseigne un libellé et un montant valide."); return; }
    setSaving(true);
    const row = {
      user_id: userId, label: expenseDraft.label.trim(), sector: expenseDraft.sector,
      icon: SECTORS.find(s => s[0] === expenseDraft.sector)?.[1] ?? "wallet",
      amount, due_day: Math.min(31, Math.max(1, Number(expenseDraft.due_day) || 1)),
      recurrence: expenseDraft.recurrence, effective_from: expenseDraft.effective_from || month,
      effective_until: expenseDraft.effective_until || null, notes: expenseDraft.notes.trim() || null, is_active: true
    };
    const result = editingId
      ? await supabase.from("fixed_expenses").update(row).eq("id", editingId).eq("user_id", userId)
      : await supabase.from("fixed_expenses").insert(row);
    setSaving(false);
    if (result.error) { setMessage(`Erreur : ${result.error.message}`); return; }
    setMessage(`✓ Charge "${row.label}" enregistrée.`);
    resetDraft();
    await loadMonth(month, userId);
  }
  async function deleteExpense(id: string) {
    const supabase = getSupabaseBrowserClient(); if (!supabase || !userId) return;
    if (!window.confirm("Supprimer cette charge fixe ?")) return;
    setSaving(true); const { error } = await supabase.from("fixed_expenses").delete().eq("id", id).eq("user_id", userId); setSaving(false);
    setMessage(error ? `Erreur : ${error.message}` : "✓ Charge supprimée.");
    if (!error) await loadMonth(month, userId);
  }

  const budgetAlerts = useMemo(() => {
    const now = new Date();
    const selected = new Date(`${month}T12:00:00`);
    const isCurrentMonth = selected.getFullYear() === now.getFullYear() && selected.getMonth() === now.getMonth();
    const elapsedRatio = isCurrentMonth ? Math.min(Math.max(now.getDate() / daysInMonth(month), 0), 1) : selected < new Date(now.getFullYear(), now.getMonth(), 1) ? 1 : 0;
    const alerts: Array<{ level: "warning" | "danger"; title: string; detail: string }> = [];

    if (simulation.projectedEnd < 0) {
      alerts.push({ level: "danger", title: "Fin de mois négative", detail: `La simulation termine à ${money(simulation.projectedEnd)} €. Réduis les dépenses variables ou augmente les revenus prévus.` });
    } else if (simulation.margin < 0) {
      alerts.push({ level: "warning", title: "Réserve de sécurité menacée", detail: `La projection passe sous la réserve souhaitée de ${money(safetyReserve)} €.` });
    }

    if (isCurrentMonth && elapsedRatio > 0) {
      for (const envelope of envelopes) {
        if (envelope.planned <= 0 || envelope.spent <= 0) continue;
        const usage = envelope.spent / envelope.planned;
        const paceGap = usage - elapsedRatio;
        if (paceGap >= 0.30) {
          alerts.push({ level: "danger", title: `${envelope.name} : dérive forte`, detail: `${Math.round(usage * 100)} % utilisé alors qu'environ ${Math.round(elapsedRatio * 100)} % du mois est écoulé.` });
        } else if (paceGap >= 0.15) {
          alerts.push({ level: "warning", title: `${envelope.name} : rythme élevé`, detail: `${Math.round(usage * 100)} % utilisé pour ${Math.round(elapsedRatio * 100)} % du mois écoulé.` });
        }
      }
    }

    if (!alerts.length) alerts.push({ level: "warning", title: "Aucune dérive détectée", detail: isCurrentMonth ? "Les enveloppes restent dans un rythme compatible avec le calendrier du mois." : "Les alertes de rythme s'activent sur le mois en cours." });
    return alerts.slice(0, 6);
  }, [month, envelopes, simulation.projectedEnd, simulation.margin, safetyReserve]);

  const chart = useMemo(() => {
    const fixed = fixedTotal, variable = simulation.remaining, extra = extraExpense;
    const start = startingBalance, afterIncome = start + income, afterFixed = afterIncome - fixed, afterVariable = afterFixed - variable, afterExtra = afterVariable - extra;
    return [
      ["Départ", start], ["+ Revenus", afterIncome], ["- Fixes", afterFixed],
      ["- Variables", afterVariable], ["- Dépense", afterExtra]
    ];
  }, [fixedTotal, simulation.remaining, extraExpense, startingBalance, income]);

  const setMonthAndLoad = (next: string) => setMonth(next);

  return (
    <main className="app-surface-page mx-auto max-w-7xl space-y-6 px-4 py-6 pb-24 sm:px-6 sm:py-8">
  <FinancialCrossDomainSummary month={month} />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Budget prévisionnel</p>
          <h1 className="app-page-title">Budget & simulation en temps réel</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">Les charges fixes, dépenses actuelles et engagements futurs alimentent la projection et les agents LIA.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border bg-card p-2">
          <button className="rounded-lg p-2 hover:bg-muted" onClick={() => setMonthAndLoad(addMonth(month, -1))} aria-label="Mois précédent"><ChevronLeft className="h-5 w-5"/></button>
          <div className="min-w-44 text-center">
            <CalendarDays className="mr-2 inline h-4 w-4 text-primary"/>
            <span className="font-semibold capitalize">{monthLabel(month)}</span>
          </div>
          <button className="rounded-lg p-2 hover:bg-muted" onClick={() => setMonthAndLoad(addMonth(month, 1))} aria-label="Mois suivant"><ChevronRight className="h-5 w-5"/></button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 text-sm"><span className={`h-2.5 w-2.5 rounded-full ${saving ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`}/><span>{loading ? "Chargement…" : saving ? "Sauvegarde…" : message}</span></div>
        <button onClick={() => void persistScenario()} disabled={saving || !userId} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4"/> Enregistrer maintenant</button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_.95fr]">
        <Card>
          <CardHeader><CardTitle>Charges fixes détaillées</CardTitle><p className="text-sm text-muted-foreground">Ajoute chaque engagement séparément. Il est automatiquement pris en compte pour le mois sélectionné.</p></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 md:grid-cols-2">
              <label className="text-sm md:col-span-2">Libellé<input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" placeholder="Ex. Électricité EDF" value={expenseDraft.label} onChange={e => setExpenseDraft(d => ({...d,label:e.target.value}))}/></label>
              <label className="text-sm">Secteur<select className="mt-1 w-full rounded-lg border bg-background px-3 py-2" value={expenseDraft.sector} onChange={e => setExpenseDraft(d => ({...d,sector:e.target.value}))}>{SECTORS.map(([s]) => <option key={s}>{s}</option>)}</select></label>
              <label className="text-sm">Montant mensuel (€)<input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" type="number" min="0" step=".01" value={expenseDraft.amount} onChange={e => setExpenseDraft(d => ({...d,amount:e.target.value}))}/></label>
              <label className="text-sm">Jour de prélèvement<input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" type="number" min="1" max={daysInMonth(month)} value={expenseDraft.due_day} onChange={e => setExpenseDraft(d => ({...d,due_day:e.target.value}))}/></label>
              <label className="text-sm">Récurrence<select className="mt-1 w-full rounded-lg border bg-background px-3 py-2" value={expenseDraft.recurrence} onChange={e => setExpenseDraft(d => ({...d,recurrence:e.target.value as "monthly"|"one_off"}))}><option value="monthly">Tous les mois</option><option value="one_off">Ponctuelle</option></select></label>
              <label className="text-sm">Début<input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" type="date" value={expenseDraft.effective_from} onChange={e => setExpenseDraft(d => ({...d,effective_from:e.target.value}))}/></label>
              <label className="text-sm">Fin (optionnel)<input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" type="date" value={expenseDraft.effective_until} onChange={e => setExpenseDraft(d => ({...d,effective_until:e.target.value}))}/></label>
              <label className="text-sm md:col-span-2">Note<input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" placeholder="Contrat, échéance, précision…" value={expenseDraft.notes} onChange={e => setExpenseDraft(d => ({...d,notes:e.target.value}))}/></label>
              <div className="flex gap-2 md:col-span-2"><button onClick={() => void saveFixedExpense()} disabled={saving || !userId} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><CirclePlus className="h-4 w-4"/>{editingId ? "Mettre à jour" : "Ajouter la charge"}</button>{editingId && <button onClick={resetDraft} className="rounded-lg border px-4 py-2 text-sm">Annuler</button>}</div>
            </div>

            {visibleFixed.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Aucune charge fixe pour {monthLabel(month)}. Ajoute par exemple « Électricité — 85 € ».</div> :
              <div className="space-y-2">{visibleFixed.map(e => { const Icon = ICONS[e.icon] || MoreHorizontal; return <div key={e.id} className="flex items-center gap-3 rounded-xl border p-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted"><Icon className="h-5 w-5"/></div>
                <div className="min-w-0 flex-1"><p className="font-semibold">{e.label}</p><p className="text-xs text-muted-foreground">{e.sector} · {e.recurrence === "monthly" ? "mensuel" : "ponctuel"} · prélèvement le {e.due_day ?? "—"}</p></div>
                <strong className="financial-number">{money(e.amount)} €</strong>
                <button onClick={() => editExpense(e)} className="rounded-lg p-2 hover:bg-muted" aria-label={`Modifier ${e.label}`}><Pencil className="h-4 w-4"/></button>
                <button onClick={() => void deleteExpense(e.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label={`Supprimer ${e.label}`}><Trash2 className="h-4 w-4"/></button>
              </div>})}</div>}
            <div className="flex items-center justify-between border-t pt-4"><span className="font-semibold">Total charges fixes</span><strong className="financial-number text-xl">{money(fixedTotal)} €</strong></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Hypothèses du mois</CardTitle><p className="text-sm text-muted-foreground">Chaque modification est sauvegardée automatiquement.</p></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {[
              ["Revenu mensuel (€)", income, "income"], ["Solde de départ (€)", startingBalance, "startingBalance"],
              ["Réserve souhaitée (€)", safetyReserve, "safetyReserve"], ["Dépense supplémentaire (€)", extraExpense, "extraExpense"],
              ["Semaines restantes", weeksRemaining, "weeksRemaining"]
            ].map(([label, value, key]) => <label key={String(key)} className="text-sm"><span className="font-medium">{label}</span><input className="mt-1 w-full rounded-lg border bg-background px-3 py-2" type="number" min={key === "weeksRemaining" ? 1 : undefined} step={key === "weeksRemaining" ? 1 : ".01"} value={value as number} onChange={e => changeNumber(key as "income"|"startingBalance"|"safetyReserve"|"extraExpense"|"weeksRemaining", Number(e.target.value) || 0)}/></label>)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[["Dépenses prévues", simulation.planned], ["Reste variables", simulation.remaining], ["Fin de mois", simulation.projectedEnd], ["Budget / semaine", simulation.weeklyBudget]].map(([title, value]) => <Card key={String(title)}><CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader><CardContent><p className={`financial-number text-2xl font-bold ${Number(value) < 0 ? "text-red-600 dark:text-red-400" : ""}`}>{Number(value) >= 0 && title === "Fin de mois" ? "+" : ""}{money(Number(value))} €</p></CardContent></Card>)}
      </div>

      <Card>
        <CardHeader><CardTitle>Alertes de dérive</CardTitle><p className="text-sm text-muted-foreground">Détection déterministe : le rythme de dépense est comparé au temps écoulé, sans interprétation IA.</p></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {budgetAlerts.map((alert, index) => <div key={`${alert.title}-${index}`} className={`rounded-xl border p-4 ${alert.level === "danger" ? "border-red-300 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/20" : "border-amber-300 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20"}`}>
            <div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${alert.level === "danger" ? "bg-red-500" : "bg-amber-500"}`} /><p className="font-semibold">{alert.title}</p></div>
            <p className="mt-2 text-sm text-muted-foreground">{alert.detail}</p>
          </div>)}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader><CardTitle>Impact des dépenses sur la trésorerie</CardTitle><p className="text-sm text-muted-foreground">Lecture directe des gains/pertes : chaque bloc montre le solde après l'étape.</p></CardHeader>
          <CardContent>
            <div className="overflow-x-auto pb-2"><div className="flex min-w-[680px] items-end gap-2">
              {chart.map(([label, value], i) => <div key={`${label || "chart-point"}-${i}`} className="flex w-32 flex-col justify-end gap-2"><div className={`flex h-44 items-end rounded-lg bg-muted p-2`}><div className={`w-full rounded-md ${Number(value) >= 0 ? "bg-emerald-500/75" : "bg-red-500/75"}`} style={{height: `${Math.max(8, Math.min(100, Math.abs(Number(value)) / Math.max(Math.abs(startingBalance), Math.abs(income), 1) * 100))}%`}}/></div><p className="text-center text-xs text-muted-foreground">{label}</p><p className={`text-center font-bold ${Number(value) < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>{Number(value) >= 0 ? "+" : ""}{money(Number(value))} €</p>{i < chart.length - 1 && <span className="hidden" />}</div>)}
            </div></div></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Enveloppes variables</CardTitle><p className="text-sm text-muted-foreground">Les variables complètent les charges fixes et sont incluses dans la projection. Les dépenses affectées depuis Transactions mettent automatiquement à jour « Dépensé ».</p></CardHeader>
          <CardContent className="space-y-3">
            {envelopes.map(e => {
              const isAddingPlanned = additionTarget?.id === e.id && additionTarget.field === "planned";
              const isAddingSpent = additionTarget?.id === e.id && additionTarget.field === "spent";
              const additionOpen = isAddingPlanned || isAddingSpent;
              return <div key={e.id} className="rounded-xl border p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_150px_150px_auto] sm:items-end">
                  <label className="text-xs"><span className="text-muted-foreground">Poste</span><input className="mt-1 w-full rounded-lg border bg-background px-2 py-2" value={e.name} onChange={ev => updateEnvelope(e.id,"name",ev.target.value)}/></label>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Prévu</span>
                    <div className="mt-1 flex gap-1">
                      <input className="min-w-0 w-full rounded-lg border bg-background px-2 py-2" type="number" min="0" step=".01" value={e.planned} onChange={ev => updateEnvelope(e.id,"planned",ev.target.value)}/>
                      <button type="button" onClick={() => openEnvelopeAddition(e.id,"planned")} className="shrink-0 rounded-lg border bg-background px-2 text-primary hover:bg-accent" aria-label={`Ajouter au prévu de ${e.name}`} title="Ajouter au prévu"><Plus className="h-4 w-4"/></button>
                    </div>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Dépensé</span>
                    <div className="mt-1 flex gap-1">
                      <input className="min-w-0 w-full rounded-lg border bg-background px-2 py-2" type="number" min="0" step=".01" value={e.spent} onChange={ev => updateEnvelope(e.id,"spent",ev.target.value)}/>
                      <button type="button" onClick={() => openEnvelopeAddition(e.id,"spent")} disabled={addingEnvelopeExpenseId === e.id} className="shrink-0 rounded-lg border bg-background px-2 text-primary hover:bg-accent disabled:opacity-50" aria-label={`Ajouter une dépense à ${e.name}`} title="Ajouter une dépense"><Plus className="h-4 w-4"/></button>
                    </div>
                  </div>
                  <button onClick={() => removeEnvelope(e.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30" aria-label={`Supprimer ${e.name}`}><Trash2 className="h-4 w-4"/></button>
                </div>
                {additionOpen && <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Ajouter à {additionTarget?.field === "spent" ? "Dépensé" : "Prévu"} :</span>
                    <div className="flex min-w-[180px] flex-1 gap-1 sm:flex-none">
                      <input autoFocus className="w-full rounded-lg border bg-background px-3 py-2 text-sm" type="number" min="0.01" step=".01" placeholder="Ex. 25" value={additionValue} onChange={ev => setAdditionValue(ev.target.value)} onKeyDown={ev => { if (ev.key === "Enter") applyEnvelopeAddition(); if (ev.key === "Escape") cancelEnvelopeAddition(); }} aria-label={`Montant à ajouter à ${e.name}`} />
                      <button type="button" onClick={applyEnvelopeAddition} disabled={!additionValue} className="rounded-lg bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50" aria-label="Valider l'ajout"><Check className="h-4 w-4"/></button>
                      <button type="button" onClick={cancelEnvelopeAddition} className="rounded-lg border px-3 py-2 hover:bg-muted" aria-label="Annuler"><X className="h-4 w-4"/></button>
                    </div>
                    <span className="text-xs text-muted-foreground">Pour « Dépensé », le montant crée maintenant une vraie transaction et la rattache automatiquement à cette enveloppe. Pour « Prévu », le montant est simplement ajouté au budget.</span>
                  </div>
                </div>}
                <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{e.planned > 0 ? Math.round(e.spent / e.planned * 100) : 0}% utilisé</span><span>Reste {money(Math.max(e.planned-e.spent,0))} €</span></div>
                <ProgressBar value={Math.max(e.spent,0)} max={Math.max(e.planned,1)}/>
              </div>;
            })}
            <div className="flex gap-2"><input className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Nouvelle enveloppe…" value={newEnvelope} onChange={e=>setNewEnvelope(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addEnvelope()}/><button onClick={addEnvelope} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Ajouter</button></div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
