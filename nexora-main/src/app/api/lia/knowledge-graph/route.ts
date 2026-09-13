import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { assertSameOrigin } from "@/lib/security/csrf";
import { buildKnowledgeGraph, persistKnowledgeGraph, type KnowledgeNode } from "@/lib/lia/knowledge-graph";
import { buildNexoraWorldModel } from "@/lib/lia/world-model-kernel";
import { buildNexoraTemporalWorldModel } from "@/lib/lia/temporal-world-model-kernel";
export async function POST(request: Request) {
  try { assertSameOrigin(request); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "forbidden" }, { status: 403 }); }
  const supabase = await createClient(); if (!supabase) return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser(); if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null); let nodes: KnowledgeNode[] = [];
  if (body && Array.isArray(body.nodes)) nodes = body.nodes.filter((x: unknown): x is KnowledgeNode => !!x && typeof x === "object" && typeof (x as KnowledgeNode).id === "string" && typeof (x as KnowledgeNode).topic === "string" && typeof (x as KnowledgeNode).claim === "string" && typeof (x as KnowledgeNode).state === "string" && typeof (x as KnowledgeNode).confidence === "number").slice(0, 200);
  if (!nodes.length) return NextResponse.json({ error: "nodes_required" }, { status: 400 });
  const graph = buildKnowledgeGraph(nodes);
  const worldModel = buildNexoraWorldModel(graph.nodes, graph.edges);
  const temporalWorldModel = buildNexoraTemporalWorldModel(graph.nodes, graph.edges); const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && secret) { const admin = createAdminClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } }); try { await persistKnowledgeGraph(admin, user.id, graph); } catch (e) { return NextResponse.json({ error: "knowledge_graph_persistence_failed", detail: e instanceof Error ? e.message : "unknown", graph }, { status: 500 }); } }
  return NextResponse.json({ status: "knowledge_graph_review", ...graph, worldModel, temporalWorldModel }, { status: 200 });
}
