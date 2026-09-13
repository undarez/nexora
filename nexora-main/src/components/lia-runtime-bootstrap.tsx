"use client";

import { useEffect } from "react";

/**
 * Low-frequency client bootstrap for LIA runtime provisioning.
 * It lives in the protected shell so entering any authenticated area can
 * provision the user's autonomous learning/surveillance jobs once per session.
 */
export function LiaRuntimeBootstrap() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "nexora:lia-cron-bootstrap:v2";
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "pending");
    void fetch("/api/lia/runtime/bootstrap", { method: "POST" })
      .then((response) => {
        if (response.ok) window.sessionStorage.setItem(key, "done");
        else window.sessionStorage.removeItem(key);
      })
      .catch(() => window.sessionStorage.removeItem(key));
  }, []);

  return null;
}
