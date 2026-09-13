"use client";

import { useState } from "react";
import { Volume2, VolumeX, Loader2 } from "lucide-react";

export function NexoVoiceButton() {
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function speak() {
    if (busy || speaking) return;
    setBusy(true); setError(null);
    try {
      const text = window.getSelection()?.toString().trim() || "Bonjour, je suis Nexo. Je peux vous accompagner dans l'analyse de vos finances.";
      const response = await fetch("/api/lia/voice/synthesize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.slice(0, 5000) }) });
      if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error || "Voix Nexo indisponible."); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onplay = () => setSpeaking(true);
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); setError("Lecture audio impossible."); };
      await audio.play();
    } catch (e) { setError(e instanceof Error ? e.message : "Voix Nexo indisponible."); }
    finally { setBusy(false); }
  }

  return <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
    <button type="button" onClick={() => void speak()} disabled={busy || speaking} title="Faire parler Nexo" aria-label="Faire parler Nexo" className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-semibold shadow-lg transition hover:scale-[1.02] disabled:opacity-60">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      {speaking ? "Nexo parle…" : "Écouter Nexo"}
    </button>
    {error && <p className="mt-1 max-w-[320px] rounded-lg border bg-card px-3 py-1 text-center text-[10px] text-destructive shadow">{error}</p>}
  </div>;
}
