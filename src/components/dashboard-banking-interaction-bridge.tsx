"use client";

import { useEffect } from "react";

const PERIOD_DAYS: Record<string, number> = { "1J": 1, "1S": 7, "1M": 30, "3M": 90, "1A": 365, "TOUT": 1825 };

function setActivePeriod(node: HTMLElement) {
  document.querySelectorAll(".nexora-periods span, .nexora-periods b").forEach((item) => {
    if (!(item instanceof HTMLElement)) return;
    item.style.background = "transparent";
    item.style.color = "rgba(255,255,255,.6)";
  });
  node.style.background = "#7552f0";
  node.style.color = "#fff";
  node.style.borderRadius = "7px";
}

function drawHistory(points: Array<{ date: string; eur: number }>) {
  const svg = document.querySelector(".nexora-line-chart svg");
  if (!(svg instanceof SVGElement)) return;
  const values = points.map((point) => Number(point.eur)).filter(Number.isFinite);
  if (!values.length) return;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const coords = values.map((value, index) => {
    const x = 8 + (index / Math.max(values.length - 1, 1)) * 88;
    const y = 88 - ((value - min) / range) * 64;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  svg.querySelector("polyline")?.setAttribute("points", coords.join(" "));
  svg.querySelector("polygon")?.setAttribute("points", `12,100 ${coords.join(" ")} 96,100`);
}

async function loadPeriod(label: string) {
  const days = PERIOD_DAYS[label];
  if (!days) return;
  try {
    const response = await fetch(`/api/banking/history?days=${days}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { points?: Array<{ date: string; eur: number }> };
    drawHistory(Array.isArray(data.points) ? data.points : []);
  } catch {
    // Keep the dashboard usable when historical banking data is unavailable.
  }
}

async function connectPowens() {
  try {
    const response = await fetch("/api/banking/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "powens" }),
    });
    const data = await response.json();
    if (response.ok && data.authorizationUrl) {
      window.location.assign(data.authorizationUrl);
      return;
    }
    const notice = document.createElement("div");
    notice.textContent = data.error ?? "Connexion bancaire impossible.";
    notice.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:99999;max-width:420px;padding:14px 16px;border:1px solid rgba(117,82,240,.4);border-radius:12px;background:#111827;color:#fff;font:500 14px/1.4 system-ui,sans-serif;box-shadow:0 16px 40px rgba(0,0,0,.3)";
    document.body.appendChild(notice);
    window.setTimeout(() => notice.remove(), 6000);
  } catch {
    // Keep the page usable if the request cannot be started.
  }
}

export function DashboardBankingInteractionBridge() {
  useEffect(() => {
    let disposed = false;
    const bind = () => {
      if (disposed) return;
      document.querySelectorAll(".nexora-periods span, .nexora-periods b").forEach((node) => {
        if (!(node instanceof HTMLElement) || node.dataset.nexoraBound === "1") return;
        const label = node.textContent?.trim() ?? "";
        if (!PERIOD_DAYS[label]) return;
        node.dataset.nexoraBound = "1";
        node.setAttribute("role", "button");
        node.setAttribute("tabindex", "0");
        node.style.cursor = "pointer";
        node.style.position = "relative";
        node.style.zIndex = "30";
        node.style.pointerEvents = "auto";
        node.addEventListener("click", () => {
          setActivePeriod(node);
          void loadPeriod(label);
        });
        node.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            node.click();
          }
        });
      });

      document.querySelectorAll("button").forEach((button) => {
        if (button.textContent?.trim() !== "Ajouter une banque") return;
        button.style.pointerEvents = "auto";
        button.style.cursor = "pointer";
        button.style.filter = "none";
        button.style.opacity = "1";
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!(button instanceof HTMLButtonElement) || button.textContent?.trim() !== "Ajouter une banque") return;
      if (!button.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      void connectPowens();
    };

    bind();
    document.addEventListener("pointerdown", onPointerDown, true);
    const observer = new MutationObserver(bind);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["disabled"] });
    const timer = window.setInterval(bind, 500);

    return () => {
      disposed = true;
      document.removeEventListener("pointerdown", onPointerDown, true);
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
