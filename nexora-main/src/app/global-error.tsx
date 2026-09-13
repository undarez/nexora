"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[NEXORA] erreur d'interface", error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <h1 className="text-xl font-semibold">NEXORA a rencontré un problème</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              L’écran n’a pas pu être affiché correctement. Vos données enregistrées ne sont pas supprimées.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-5 min-h-11 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground"
            >
              Réessayer
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
