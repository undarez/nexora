"use client";

import { useEffect, useState } from 'react';
import { User, Save, CheckCircle2, Trash2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowserClient } from '@/lib/supabase';

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [assistantStyle, setAssistantStyle] = useState('normal');
  const [financialGoal, setFinancialGoal] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setLoading(false); return; }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/auth'; return; }
      setEmail(user.email ?? '');
      const { data } = await supabase.from('profiles').select('display_name,currency,assistant_style,financial_goal').eq('id', user.id).maybeSingle();
      if (data) {
        setDisplayName(data.display_name ?? '');
        setCurrency(data.currency ?? 'EUR');
        setAssistantStyle(data.assistant_style ?? 'normal');
        setFinancialGoal(data.financial_goal ?? '');
      }
      setLoading(false);
    };
    void load();
  }, []);

  const save = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true); setSaved(false);
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      display_name: displayName.trim().slice(0, 80) || null,
      currency,
      assistant_style: assistantStyle,
      financial_goal: financialGoal.trim().slice(0, 300) || null,
    });
    setSaving(false);
    if (!error) { setSaved(true); window.setTimeout(() => setSaved(false), 2500); }
  };

  const deleteAccount = async () => {
    if (deleteText !== "SUPPRIMER") return;
    setDeleting(true); setDeleteError("");
    const response = await fetch("/api/account/delete", { method: "POST" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setDeleteError(body.error ?? "Impossible de supprimer le compte."); setDeleting(false); return; }
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/auth?message=account-deleted";
  };

  if (loading) return <main className="mx-auto max-w-4xl px-6 py-10"><p className="text-sm text-muted-foreground">Chargement du profil…</p></main>;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div>
        <p className="text-sm font-semibold text-primary">Mon espace</p>
        <h1 className="text-3xl font-bold">Mon profil</h1>
        <p className="mt-2 text-sm text-muted-foreground">Personnalise ton expérience Gérer Finance et la façon dont Nexo t'accompagne.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" />Identité</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm"><span className="font-medium">Nom affiché</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ton prénom ou nom" className="w-full rounded-xl border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
          <label className="space-y-2 text-sm"><span className="font-medium">Email</span><input value={email} readOnly className="w-full rounded-xl border bg-muted px-3 py-2 text-muted-foreground" /></label>
          <label className="space-y-2 text-sm"><span className="font-medium">Devise</span><select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full rounded-xl border bg-background px-3 py-2"><option value="EUR">Euro (€)</option><option value="USD">Dollar ($)</option><option value="GBP">Livre (£)</option><option value="CHF">Franc suisse</option></select></label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Mon accompagnement</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <label className="space-y-2 text-sm block"><span className="font-medium">Style de Nexo</span><select value={assistantStyle} onChange={(e) => setAssistantStyle(e.target.value)} className="w-full rounded-xl border bg-background px-3 py-2"><option value="simple">Simple et pédagogique</option><option value="normal">Équilibré</option><option value="detaille">Détaillé et analytique</option></select></label>
          <label className="space-y-2 text-sm block"><span className="font-medium">Mon objectif financier principal</span><textarea value={financialGoal} onChange={(e) => setFinancialGoal(e.target.value)} placeholder="Ex. constituer une épargne de sécurité, réduire mes dépenses…" className="min-h-24 w-full rounded-xl border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring" /></label>
          <div className="flex items-center gap-3"><Button onClick={() => void save()} disabled={saving}><Save className="mr-2 h-4 w-4" />{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>{saved && <span className="flex items-center gap-1.5 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />Enregistré</span>}</div>
        </CardContent>
      </Card>
      <Card className="border-red-500/30">
        <CardHeader><CardTitle className="flex items-center gap-2 text-red-600"><ShieldAlert className="h-5 w-5" />Zone de suppression définitive</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Cette action supprime définitivement ton compte d'authentification et les données liées par cascade. Elle est irréversible : si tu reviens plus tard, tu devras créer un nouveau compte.</p>
          <label className="block space-y-2 text-sm"><span className="font-medium">Tape SUPPRIMER pour confirmer</span><input value={deleteText} onChange={(e)=>setDeleteText(e.target.value)} className="w-full rounded-xl border bg-background px-3 py-2" placeholder="SUPPRIMER" /></label>
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
          <Button className="bg-red-600 hover:bg-red-700" disabled={deleting || deleteText !== "SUPPRIMER"} onClick={()=>void deleteAccount()}><Trash2 className="mr-2 h-4 w-4" />{deleting?"Suppression…":"Supprimer définitivement mon compte"}</Button>
        </CardContent>
      </Card>
    </main>
  );
}
