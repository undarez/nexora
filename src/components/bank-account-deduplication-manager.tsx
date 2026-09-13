"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Account = {
  id: string;
  name: string;
  provider: string;
  external_account_id: string;
  iban_masked: string | null;
  currency: string;
  balance: number | null;
  available_balance: number | null;
  status: string;
  last_synced_at: string | null;
};

type DuplicateGroup = { key: string; accounts: Account[] };

const money = (value: number | null, currency: string) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency || "EUR" }).format(Number(value ?? 0));

export function BankAccountDeduplicationManager() {
  const pathname = usePathname();
  const router = useRouter();
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const duplicateAccounts = useMemo(() => groups.reduce((sum, group) => sum + Math.max(group.accounts.length - 1, 0), 0), [groups]);

  async function loadDuplicates(showNotice = true) {
    try {
      const response = await fetch("/api/banking/duplicates", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { duplicates?: DuplicateGroup[] };
      const nextGroups = Array.isArray(data.duplicates) ? data.duplicates : [];
      setGroups(nextGroups);
      if (showNotice && nextGroups.length) {
        setNotice(`${nextGroups.length} compte(s) identique(s) détecté(s). NEXORA n'additionnera pas leurs soldes et n'affichera qu'une seule occurrence.`);
        window.setTimeout(() => setNotice(null), 7000);
      }
    } catch {
      // The banking page remains usable if duplicate detection is temporarily unavailable.
    }
  }

  async function keepAccount(accountId: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/banking/accounts/deduplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keepAccountId: accountId }),
      });
      const data = (await response.json()) as { error?: string; disabledCount?: number };
      if (!response.ok) {
        setNotice(data.error ?? "Impossible de corriger le doublon.");
        return;
      }
      setNotice(`Doublon corrigé. ${data.disabledCount ?? 0} occurrence(s) masquée(s) sans supprimer les données bancaires.`);
      setOpen(false);
      await loadDuplicates(false);
      router.refresh();
      window.setTimeout(() => setNotice(null), 5000);
    } catch {
      setNotice("Impossible de corriger le doublon pour le moment.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (pathname !== "/banque") return;
    void loadDuplicates(true);
    const timer = window.setInterval(() => void loadDuplicates(false), 60000);
    return () => window.clearInterval(timer);
  }, [pathname]);

  if (pathname !== "/banque") return null;

  return (
    <>
      {notice && (
        <div className="fixed bottom-24 right-6 z-[100] max-w-[420px] rounded-xl border border-violet-400/30 bg-slate-950 px-4 py-3 text-sm text-white shadow-2xl">
          <div className="font-semibold text-violet-200">Gestion des comptes bancaires</div>
          <div className="mt-1 text-slate-300">{notice}</div>
        </div>
      )}

      {groups.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[99] rounded-xl border border-violet-400/40 bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-violet-500"
        >
          Gérer les doublons{duplicateAccounts > 0 ? ` (${duplicateAccounts})` : ""}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onMouseDown={() => !busy && setOpen(false)}>
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950 p-5 text-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Comptes en doublon</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Le même compte peut apparaître après une nouvelle connexion Powens. Choisis l'occurrence à conserver.
                </p>
              </div>
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/5 hover:text-white">✕</button>
            </div>

            <div className="mt-5 space-y-4">
              {groups.map((group) => (
                <div key={group.key} className="rounded-xl border border-white/10 p-3">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-violet-300">Même compte détecté</div>
                  <div className="space-y-2">
                    {group.accounts.map((account) => (
                      <div key={account.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <div className="min-w-0">
                          <div className="font-medium">{account.name}</div>
                          <div className="text-xs text-slate-400">{account.iban_masked ?? "Identifiant bancaire non disponible"} · {account.currency} · {account.status}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="font-semibold">{money(account.balance, account.currency)}</span>
                          <button
                            type="button"
                            disabled={busy || account.status === "active" && group.accounts.filter((item) => item.status === "active").length === 1}
                            onClick={() => void keepAccount(account.id)}
                            className="rounded-lg border border-violet-400/30 bg-violet-500/15 px-3 py-2 text-xs font-semibold text-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {account.status === "active" ? "Conserver" : "Conserver celui-ci"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-lg bg-emerald-500/10 p-3 text-xs text-emerald-200">
              La correction désactive seulement l'occurrence en trop. Les transactions et l'historique ne sont pas supprimés.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
