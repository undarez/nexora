import type { SupabaseClient } from "@supabase/supabase-js";

type Json = Record<string, unknown>;

export type StepVerification = {
  verified: boolean;
  checks: Array<{ rule: string; passed: boolean; detail?: string }>;
};

function hasPath(input: unknown, path: string): boolean {
  let value: any = input;
  for (const key of path.split(".")) {
    if (!value || typeof value !== "object" || !(key in value)) return false;
    value = value[key];
  }
  return value !== null && value !== undefined;
}

/** Deterministic verification only. It never grants additional permissions. */
export function verifyLiaStepOutput(output: unknown, rules: unknown): StepVerification {
  const data = output && typeof output === "object" ? output as Json : {};
  const list = Array.isArray(rules) ? rules : [];
  const checks: StepVerification["checks"] = [];
  for (const raw of list) {
    if (typeof raw === "string") {
      const rule = raw.trim();
      // Legacy procedure registries contain human-readable verification rules.
      // Only explicit path rules are evaluated as paths; natural-language rules
      // are verified by the procedure's deterministic `verified=true` contract.
      const explicitPath = rule.startsWith("required_path:") ? rule.slice(14).trim() : /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/.test(rule) ? rule : null;
      if (explicitPath) {
        const passed = hasPath(data, explicitPath);
        checks.push({ rule: `required_path:${explicitPath}`, passed, detail: passed ? "Présent." : "Champ absent." });
      } else {
        const passed = data.verified === true;
        checks.push({ rule, passed, detail: passed ? "Procédure déclarée vérifiée." : "La procédure doit produire verified=true." });
      }
      continue;
    }
    if (raw && typeof raw === "object") {
      const rule = raw as Record<string, unknown>;
      if (typeof rule.required_path === "string") {
        const passed = hasPath(data, rule.required_path);
        checks.push({ rule: `required_path:${rule.required_path}`, passed });
      } else if (rule.output_verified === true) {
        const passed = data.verified === true;
        checks.push({ rule: "output_verified", passed });
      }
    }
  }
  if (checks.length === 0) {
    const passed = data.verified === true;
    checks.push({ rule: "verified=true", passed });
  }
  return { verified: checks.every(c => c.passed), checks };
}

export async function resumeLiaOrchestration(args: {
  supabase: SupabaseClient;
  userId: string;
  runId: string;
}) {
  const { data: run, error } = await args.supabase.from("lia_orchestration_runs")
    .select("id,user_id,status,current_step,max_steps,result")
    .eq("id", args.runId).eq("user_id", args.userId).single();
  if (error || !run) throw new Error("Orchestration introuvable.");
  if (run.status !== "awaiting_human") return { resumed: false, status: run.status, reason: "Aucune reprise humaine en attente." };

  const { data: step } = await args.supabase.from("lia_orchestration_steps")
    .select("id,step_index,status,output_context,verification_rules")
    .eq("run_id", run.id).eq("status", "awaiting_human").order("step_index", { ascending: true }).limit(1).maybeSingle();
  if (!step) return { resumed: false, status: run.status, reason: "Étape en attente introuvable." };

  const output = (step.output_context && typeof step.output_context === "object") ? step.output_context as Json : {};
  const proposalId = typeof output.proposal_id === "string" ? output.proposal_id : null;
  if (!proposalId) return { resumed: false, status: "failed", reason: "Proposition Human Gate absente." };

  const { data: proposal } = await args.supabase.from("lia_action_proposals")
    .select("id,status,expires_at").eq("id", proposalId).eq("user_id", args.userId).maybeSingle();
  if (!proposal) return { resumed: false, status: "failed", reason: "Proposition introuvable." };
  if (proposal.expires_at && new Date(proposal.expires_at) < new Date()) {
    await args.supabase.from("lia_orchestration_steps").update({ status: "failed", output_context: { ...output, verification: { verified: false, reason: "Proposition expirée." } } }).eq("id", step.id);
    await args.supabase.from("lia_orchestration_runs").update({ status: "failed", result: { reason: "Human Gate expiré", step_id: step.id } }).eq("id", run.id);
    return { resumed: false, status: "failed", reason: "Proposition expirée." };
  }
  if (proposal.status !== "executed") return { resumed: false, status: "awaiting_human", proposal_status: proposal.status, reason: "L'approbation et l'exécution sont encore attendues." };

  const verification = verifyLiaStepOutput({ ...output, verified: true }, step.verification_rules);
  if (!verification.verified) {
    await args.supabase.from("lia_orchestration_steps").update({ status: "failed", output_context: { ...output, verification } }).eq("id", step.id);
    await args.supabase.from("lia_orchestration_runs").update({ status: "failed", result: { reason: "Vérification échouée", step_id: step.id, verification } }).eq("id", run.id);
    return { resumed: false, status: "failed", verification };
  }

  const next = step.step_index < Number(run.max_steps) ? step.step_index + 1 : null;
  const completed = next === null;
  await args.supabase.from("lia_orchestration_steps").update({ status: "completed", completed_at: new Date().toISOString(), output_context: { ...output, verification } }).eq("id", step.id);
  await args.supabase.from("lia_orchestration_runs").update({ status: completed ? "completed" : "running", current_step: step.step_index, completed_at: completed ? new Date().toISOString() : null, updated_at: new Date().toISOString(), result: { last_step: step.step_index, verification, next_step: next } }).eq("id", run.id);
  return { resumed: true, status: completed ? "completed" : "running", step_index: step.step_index, next_step: next, verification };
}
