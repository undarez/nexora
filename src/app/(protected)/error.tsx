"use client";

export default function ProtectedError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Impossible d’afficher cette page</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Une erreur temporaire est survenue. Réessayez sans perdre votre session.
        </p>
        <button type="button" onClick={() => reset()} className="mt-5 min-h-11 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">
          Réessayer
        </button>
      </div>
    </main>
  );
}
