import { LoaderCircle } from "lucide-react";

export default function ProtectedLoading() {
  return (
    <div className="page-loader" role="status" aria-live="polite" aria-label="Chargement de la page">
      <div className="page-loader-card">
        <div className="page-loader-icon"><LoaderCircle className="h-7 w-7 animate-spin text-primary" /></div>
        <div>
          <p className="text-sm font-bold">Chargement</p>
          <p className="mt-1 text-xs text-muted-foreground">LIA prépare votre espace…</p>
        </div>
      </div>
    </div>
  );
}
