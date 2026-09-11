import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <div className="page-loader" role="status" aria-live="polite" aria-label="Chargement">
      <div className="page-loader-card">
        <div className="page-loader-icon"><LoaderCircle className="h-7 w-7 animate-spin text-primary" /></div>
        <div><p className="text-sm font-bold">Gérer Finance</p><p className="mt-1 text-xs text-muted-foreground">Chargement de votre espace…</p></div>
      </div>
    </div>
  );
}
