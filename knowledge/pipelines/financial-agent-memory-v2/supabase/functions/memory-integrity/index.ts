import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function sha256(v: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(v));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,"0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed",{status:405});
  const b = await req.json();
  const observed = await sha256(b.content);
  const ok = !b.expected_hash || b.expected_hash === observed;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (!ok) await supabase.from("financial_memory_integrity_events").insert({
    memory_id:b.memory_id, expected_hash:b.expected_hash, observed_hash:observed,
    event_type:"mutation", severity:"high", details:{reason:"hash mismatch"}
  });
  return Response.json({memory_id:b.memory_id, observed_hash:observed, integrity_ok:ok});
});