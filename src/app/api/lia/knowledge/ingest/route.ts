import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security/csrf";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error("Configuration serveur incomplète.");
  return createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Requête refusée." }, { status: 403 }); }
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Client Supabase indisponible." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  try { await requireAdmin(supabase); } catch { return NextResponse.json({ error: "Accès administrateur requis." }, { status: 403 }); }
  try {
    const body = await request.json();
    const sourceKey = String(body?.source_key || "").slice(0,120);
    const title = String(body?.title || "").slice(0,300);
    const publisher = body?.publisher ? String(body.publisher).slice(0,200) : null;
    const url = String(body?.url || "").slice(0,2000);
    const statement = String(body?.statement || "").trim().slice(0,5000);
    const authority = String(body?.authority || "C");
    if (!sourceKey || !title || !url || !statement || !["A","B","C","D","E"].includes(authority)) return NextResponse.json({ error: "source_key, title, url, statement et authority sont requis." }, { status: 400 });
    const admin = adminClient();
    const { data: source, error: sourceError } = await admin.from("financial_knowledge_sources").upsert({ source_key: sourceKey, title, publisher, url, authority, status:"active" }, { onConflict:"source_key" }).select("id").single();
    if (sourceError || !source) throw new Error(sourceError?.message || "source_create_failed");
    const hash = crypto.createHash("sha256").update(statement).digest("hex");
    const { data: item, error: itemError } = await admin.from("financial_knowledge_items").upsert({ knowledge_key:`${sourceKey}:${hash.slice(0,16)}`, knowledge_type:String(body?.knowledge_type || "claim"), domain:String(body?.domain || "financial_agents"), title, statement, authority, confidence:Math.min(1,Math.max(0,Number(body?.confidence ?? 0.75))), status:"proposed", tags:Array.isArray(body?.tags) ? body.tags.slice(0,20) : [], metadata:{ ingested_by:user.email, source_key:sourceKey, evidence_required:true } }, { onConflict:"knowledge_key" }).select("id,knowledge_key,status").single();
    if (itemError || !item) throw new Error(itemError?.message || "knowledge_item_create_failed");
    await admin.from("financial_knowledge_evidence").insert({ knowledge_id:item.id, source_id:source.id, evidence_location:String(body?.location || "").slice(0,500), excerpt:statement.slice(0,2000), evidence_hash:hash });
    return NextResponse.json({ ok:true, knowledge:item, status:"proposed", message:"Connaissance ingérée comme candidate. Une validation gouvernée est requise avant récupération par défaut." });
  } catch (error) { return NextResponse.json({ error:error instanceof Error ? error.message : "ingestion_failed" }, { status:500 }); }
}
