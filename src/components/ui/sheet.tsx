"use client";

import type React from "react";
import { useEffect } from "react";
import { X } from "lucide-react";

export function Sheet({
  open,
  onOpenChange,
  children,
  side = "right",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: "left" | "right";
}) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Fermer le menu"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      <aside
        className={`mobile-sheet-panel absolute top-0 h-full w-[min(88vw,360px)] border bg-background p-6 shadow-2xl animate-in ${
          side === "left" ? "left-0 border-r" : "right-0 border-l"
        }`}
      >
        <button
          className="absolute right-4 top-4 rounded-md p-2 hover:bg-muted"
          aria-label="Fermer"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-5 w-5" />
        </button>

        {children}
      </aside>
    </div>
  );
}