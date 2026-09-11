# Security review before production

- [ ] JWT/session validation uses canonical Nexora auth.
- [ ] `SERVICE_ROLE` exists only server-side.
- [ ] No frontend access to service-role credentials.
- [ ] RLS policies reviewed for every exposed table.
- [ ] Decision Gate is the only authorization boundary.
- [ ] Tool policies are enforced server-side.
- [ ] Runtime kill switch checked before consequential actions.
- [ ] Knowledge and memory are treated as untrusted data for authorization.
- [ ] Prompt injection defenses cover retrieved knowledge and memory.
- [ ] Tool arguments are schema-validated.
- [ ] Every consequential action has evidence and verification.
- [ ] Retry/replan limits are enforced.
- [ ] Security/performance advisors are clean or accepted with documented rationale.
- [ ] Read-only dry runs pass before enabling side effects.
