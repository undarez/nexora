import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { legalConfig, legalPlaceholder } from "@/lib/legal/config";

export function LegalPage({ title, eyebrow, intro, children, showPlaceholder = true }: { title: string; eyebrow?: string; intro?: string; children: ReactNode; showPlaceholder?: boolean }) {
  return (
    <main className="min-h-[70vh] py-10 sm:py-16">
      <div className="app-section max-w-4xl">
        <header className="mb-10">
          {eyebrow && <p className="landing-eyebrow">{eyebrow}</p>}
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
          {intro && <p className="mt-4 max-w-3xl text-lg leading-8 text-muted-foreground">{intro}</p>}
          {showPlaceholder && <div className="mt-6 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" /><p><strong>Préparation juridique :</strong> {legalPlaceholder}</p></div>}
        </header>
        <div className="space-y-8 text-sm leading-7">{children}</div>
        <p className="mt-10 text-xs text-muted-foreground">Dernière mise à jour de cette version : {legalConfig.lastUpdated}.</p>
      </div>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h2 className="text-2xl font-bold tracking-tight">{title}</h2><div className="mt-3 text-muted-foreground">{children}</div></section>;
}
