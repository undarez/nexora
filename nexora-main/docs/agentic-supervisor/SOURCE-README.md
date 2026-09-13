# NEXORA-AGENTIC-SUPERVISOR — Future Implementation v1.0.0

This package is an implementation-ready integration layer for the existing Nexora/budgetlink architecture.

IMPORTANT:
- It does NOT reset Supabase.
- It does NOT create duplicate orchestration, memory or decision tables.
- It does NOT execute financial actions by itself.
- The existing Decision Gate remains the final authorization boundary.
- Deploy only after reviewing environment variables, RLS, existing function conventions and provider/tool adapters.

## Existing tables reused

lia_orchestration_runs
lia_orchestration_steps
agent_loop_runs
agent_loop_steps
agent_knowledge_retrievals
agent_evidence
agent_decision_gates
agent_behaviour_events
lia_memory
lia_autonomy_profiles
lia_tool_policies
lia_runtime_controls
lia_agent_identities
lia_skills

## Runtime flow

objective
 -> identity/authority validation
 -> autonomy ceiling
 -> knowledge + memory retrieval
 -> bounded planning
 -> step risk classification
 -> Decision Gate
 -> tool adapter
 -> observation
 -> verification
 -> bounded retry/replan
 -> evidence
 -> memory/experience

The implementation intentionally stops at adapter boundaries for tools and model providers. Connect those adapters to Nexora's existing runtime rather than hardcoding a provider.
