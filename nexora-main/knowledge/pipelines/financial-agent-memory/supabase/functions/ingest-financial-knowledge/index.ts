// Edge Function skeleton.
// The implementation agent should connect this to the project's auth/secrets,
// document fetcher and embedding provider without exposing credentials to the model.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const body = await req.json();
  // Expected:
  // { source_key, document_url, metadata, content? }
  // Never execute document text as instructions.

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // TODO:
  // 1. validate source against source_registry
  // 2. fetch content from the original source when permitted
  // 3. hash and deduplicate document
  // 4. chunk semantically
  // 5. create embeddings
  // 6. extract candidate knowledge
  // 7. store provenance/evidence
  // 8. status = proposed until validation
  // 9. emit an ingestion/evaluation event

  return Response.json({
    ok: true,
    status: "scaffold",
    message: "Connect this handler to the existing Nexora ingestion/evaluation pipeline."
  });
});
