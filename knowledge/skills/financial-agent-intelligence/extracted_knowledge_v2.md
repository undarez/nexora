# NEXORA — V2 Extracted Knowledge

## K-001 — Agentic financial systems are closed-loop systems
An agent should not be modeled as a chatbot. The relevant loop is:
observe/perceive -> retrieve context -> reason -> plan -> use tools -> observe results -> evaluate -> update appropriate memory -> continue/stop.
Evidence: SRC-001, SRC-020, SRC-009.

## K-002 — Financial agent capability stack
Core capabilities repeatedly identified in recent research:
- market/financial-context perception
- risk-aware planning under constraints
- heterogeneous tool use
- long-horizon memory
- feedback-driven improvement
Evidence: SRC-001, SRC-020.

## K-003 — Bounded autonomy
Financial agents should operate within explicit authority boundaries. Current financial-agent research identifies hallucination, reproducibility, governance and human verification as important constraints on autonomy.
Evidence: SRC-001, SRC-015.

## K-004 — Workflows vs autonomous agents
Use deterministic workflows when the task is well-defined and predictability is valuable. Use more autonomous agents when dynamic planning and tool selection are actually needed. Avoid adding agentic complexity without measurable benefit.
Evidence: SRC-009.

## K-005 — Useful orchestration patterns
Relevant patterns include routing, sequential chaining, parallelization, orchestrator-workers and evaluator-optimizer. These should be selected according to task structure rather than used by default.
Evidence: SRC-009, SRC-010, SRC-012.

## K-006 — Tool safety
Tools are potentially arbitrary execution capabilities. Tool descriptions and external content must not be treated as trusted policy. User consent, access control and clear authorization boundaries are required.
Evidence: SRC-013.

## K-007 — MCP authorization
For protected HTTP MCP deployments, authorization is based on OAuth 2.1-related mechanisms. Tokens should be bound to the intended resource/audience; token passthrough is prohibited by the current security guidance; least privilege and PKCE are important controls.
Evidence: SRC-014.

## K-008 — Memory is a security boundary
Persistent memory improves long-term usefulness but can become an attack surface. Untrusted content must never silently overwrite system policy, authorization, safety rules or identity.
Evidence: SRC-016 and OWASP memory guidance.

## K-009 — Liquidity/cash-management automation
Experiments reported by BIS indicate that general-purpose AI agents can perform certain cash-management tasks such as maintaining liquidity buffers and prioritising payments under constraints. Safe deployment still requires safeguards, oversight and further validation.
Evidence: SRC-015.

## K-010 — EU financial-sector AI governance
European supervisory authorities emphasize risk-based governance, risk management, operational resilience and mitigation of ICT/cyber risks associated with frontier AI in the financial sector.
Evidence: SRC-017.

## K-011 — DORA relevance
DORA requires financial entities to maintain a sound, comprehensive and documented ICT risk-management framework, including governance, security, resilience, incident handling, testing and third-party ICT risk management.
Evidence: SRC-018.

## K-012 — Automated decisions and profiling
GDPR Article 22 places specific constraints on solely automated decisions producing legal or similarly significant effects. Nexora must distinguish ordinary personal financial assistance from regulated/high-impact automated decisions.
Evidence: SRC-019.

## K-013 — Observability is a first-class agent capability
Production agent architectures benefit from tracing, guardrails, handoff visibility and evaluation. Nexora should persist an execution trace for consequential agent runs.
Evidence: SRC-010, SRC-011, SRC-012.

## K-014 — Sandboxed long-horizon execution
Where agents need to inspect files, execute code or perform long-running work, isolated sandbox execution and separation of credentials/orchestration from model-generated execution reduce risk.
Evidence: SRC-011.

## K-015 — Source hierarchy
Regulatory and supervisory sources outrank vendor guidance for legal/compliance rules. Academic work is evidence for technical/empirical claims. Vendor documentation is strong implementation guidance but does not create legal obligations.

## K-016 — Evidence before action
Before a consequential financial action, Nexora should be able to identify:
- user authorization/policy
- relevant financial facts
- applicable constraints
- supporting knowledge sources
- risk level
- expected consequence
- approval requirement
- execution result
