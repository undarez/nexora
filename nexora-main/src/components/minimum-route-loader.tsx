"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LoaderCircle } from "lucide-react";

const MINIMUM_MS = 350;

export function MinimumRouteLoader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const timer = window.setTimeout(() => setReady(true), MINIMUM_MS);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  if (ready) return <>{children}</>;

  return (
    <div className="page-loader" role="status" aria-live="polite" aria-label="Chargement de la page">
      <div className="page-loader-card">
        <div className="page-loader-icon"><LoaderCircle className="h-7 w-7 animate-spin text-primary" /></div>
        <div>
          <p className="text-sm font-bold">NEXORA</p>
          <p className="mt-1 text-xs text-muted-foreground">Préparation de votre espace…</p>
          <p className="mt-2 text-[10px] text-muted-foreground/80">Chargement sécurisé</p>
        </div>
      </div>
    </div>
  );
}
