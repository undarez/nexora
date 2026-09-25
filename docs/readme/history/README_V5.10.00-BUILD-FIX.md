# V5.10.00 — Build Fix

Correctifs appliqués après le build Next.js/Turbopack réel :

- `src/app/auth/page.tsx` : regroupement des deux boutons d'action dans un fragment JSX, afin de fermer correctement le bloc conditionnel `mode === "login"`.
- `src/app/api/payments/stripe/setup-intent/route.ts` : suppression du double import de `assertSameOrigin`.
- package version: `0.1.121`.

Validation : revue statique des deux erreurs de parsing signalées par Next.js. Le build complet ne peut pas être exécuté dans cet environnement car `node_modules` n'est pas installé (`next: not found`).
