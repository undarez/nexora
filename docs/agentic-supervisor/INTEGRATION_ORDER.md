# Integration order

1. Backup/export current production schema and verify migrations.
2. Review this package against the current Nexora runtime.
3. Add the Edge Function using the project deployment process.
4. Configure only server-side secrets.
5. Connect the existing authentication/session validation.
6. Connect knowledge retrieval to `agent_knowledge_retrievals`.
7. Connect memory retrieval to `lia_memory`.
8. Connect the existing Decision Gate implementation.
9. Connect tool adapters through `lia_tool_policies`.
10. Connect orchestration persistence to `lia_orchestration_runs` and `lia_orchestration_steps`.
11. Connect loop/evidence telemetry.
12. Run dry-run tests with read-only tools.
13. Enable low-risk reversible actions only.
14. Perform security/RLS/advisor checks.
15. Gradually raise autonomy only after observed stability.

Never bypass the Decision Gate from an Edge Function or frontend.
