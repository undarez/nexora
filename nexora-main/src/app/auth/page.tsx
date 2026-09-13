"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { checkPassword, passwordPolicyMessage } from "@/lib/auth/password-policy";

type Mode = "login" | "signup" | "magic";

export default function AuthPage() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [confirmationResent, setConfirmationResent] = useState(false);

  useEffect(() => {
    const reason = searchParams.get("reason");
    if (searchParams.get("message") === "confirmed") {
      setMessage("Email confirmé. Tu peux maintenant te connecter.");
    } else if (reason === "auth_required") {
      setMessage("Accès bloqué : tu dois être connecté pour accéder à cette page.");
    } else if (reason === "security") {
      setError("Accès interrompu par la protection de sécurité. Reconnecte-toi pour continuer.");
    } else if (reason === "admin_denied") {
      setError("Accès administrateur refusé. Cette zone est réservée aux comptes autorisés.");
    }
  }, [searchParams]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré dans .env.local.");
      return;
    }

    if (!email.trim()) {
      setError("Indique ton adresse email.");
      return;
    }

    if (mode === "magic") {
      setBusy(true);
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
      });
      setBusy(false);
      if (authError) setError(authError.message);
      else setMessage("Un lien de connexion vient d'être envoyé à ton email.");
      return;
    }

    if (!checkPassword(password).valid) {
      setError(passwordPolicyMessage(password));
      return;
    }

    if (mode === "signup" && password !== confirmation) {
      setError("Les deux mots de passe ne sont pas identiques.");
      return;
    }

    setBusy(true);

    if (mode === "login") {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setBusy(false);
      if (authError) setError(authError.message);
      else window.location.href = searchParams.get("next") || "/onboarding";
      return;
    }

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password, confirmation }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setError(result.error || "Impossible de créer le compte.");
      return;
    }

    if (result.hasSession) {
      window.location.href = searchParams.get("next") || "/onboarding";
    } else {
      setMessage("Compte créé. Vérifie ton email pour confirmer ton adresse.");
    }
  };

  const resendConfirmation = async () => {
    setError("");
    setMessage("");
    if (!email.trim()) { setError("Indique ton adresse email pour recevoir le lien."); return; }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/resend-confirmation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) setError(result.error || "Impossible de renvoyer le lien.");
      else { setConfirmationResent(true); setMessage("Un nouvel email de confirmation vient d’être envoyé si cette adresse correspond à un compte en attente de confirmation."); }
    } catch { setError("Impossible de contacter le serveur. Réessaie."); }
    finally { setBusy(false); }
  };

  const resetPassword = async () => {
    setError("");
    setMessage("");
    if (!email.trim()) {
      setError("Indique ton adresse email pour recevoir le lien.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) setError(result.error || "Impossible d'envoyer le lien.");
      else { setResetSent(true); setMessage("Si cette adresse possède un compte, un lien de réinitialisation vient d'être envoyé."); }
    } catch {
      setError("Impossible de contacter le serveur. Réessaie.");
    } finally { setBusy(false); }
  };

  const google = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase n'est pas configuré dans .env.local.");
      return;
    }
    setError("");
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });
    if (authError) setError(authError.message);
  };

  const title =
    mode === "login" ? "Bienvenue" :
    mode === "signup" ? "Créer ton compte" :
    "Connexion sans mot de passe";

  return (
    <main className="relative flex min-h-[calc(100vh-9rem)] items-center justify-center overflow-hidden px-4 py-12">
      <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-32 bottom-20 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl" />

      <Card className="relative w-full max-w-md overflow-hidden border-primary/10 shadow-2xl">
        <div className="h-1 bg-gradient-to-r from-primary via-blue-400 to-cyan-300" />
        <CardHeader className="space-y-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tes données financières restent associées à ton propre compte Supabase.
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Adresse email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  className="pl-9"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="toi@exemple.fr"
                />
              </div>
            </div>

            {mode !== "magic" && (
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    className="pl-9 pr-10"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="8 caractères minimum"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1.5 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
                    aria-label={showPassword ? "Masquer" : "Afficher"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === "signup" && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-xs">
                    <p className="mb-2 font-medium">Règles du mot de passe</p>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {([['minLength','8 caractères minimum'],['uppercase','1 majuscule'],['lowercase','1 minuscule'],['digit','1 chiffre'],['special','1 caractère spécial']] as const).map(([key,label]) => {
                        const ok = checkPassword(password)[key];
                        return <div key={key} className={ok ? "text-emerald-600" : "text-muted-foreground"}>{ok ? "✓" : "○"} {label}</div>;
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="confirmation">Confirmer le mot de passe</Label>
                <Input
                  id="confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="Retape ton mot de passe"
                />
                {confirmation.length > 0 && (
                  <p className={`text-xs ${password === confirmation ? "text-emerald-600" : "text-red-600"}`}>
                    {password === confirmation ? "✓ Les mots de passe correspondent." : "Les mots de passe ne correspondent pas."}
                  </p>
                )}
              </div>
            )}

            <Button className="h-10 w-full shadow-lg shadow-primary/15" disabled={busy}>
              {busy ? "Connexion…" : mode === "magic" ? "Envoyer le lien" : mode === "login" ? "Se connecter" : "Créer mon compte"}
              {!busy && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>

          {mode === "login" && (
            <>
              <button type="button" onClick={resetPassword} disabled={busy || resetSent} className="w-full text-center text-sm text-primary hover:underline disabled:opacity-60">
                {resetSent ? "Lien de réinitialisation envoyé" : "Mot de passe oublié ?"}
              </button>
              <button type="button" onClick={resendConfirmation} disabled={busy || confirmationResent} className="mt-2 w-full text-center text-sm text-muted-foreground hover:text-primary disabled:opacity-60">Renvoyer l’email de confirmation</button>
            </>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}
          {message && (
            <div className="flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {message}
            </div>
          )}

          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
              ou
            </span>
          </div>

          <Button type="button" variant="outline" className="w-full" onClick={google}>
            <span className="mr-2 grid h-5 w-5 place-items-center rounded-full bg-white text-xs font-bold text-slate-700 shadow">G</span>
            Continuer avec Google
          </Button>

          <button
            type="button"
            onClick={() => setMode(mode === "magic" ? "login" : "magic")}
            className="w-full text-center text-sm font-medium text-primary hover:underline"
          >
            {mode === "magic" ? "Utiliser email + mot de passe" : "Recevoir un lien de connexion par email"}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
              setMessage("");
            }}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "login" ? "Créer un compte" : "J'ai déjà un compte"}
          </button>
        </CardContent>
      </Card>
    </main>
  );
}
