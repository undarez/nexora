# NEXORA — Target Architecture

## Target flow

User
→ Conversation
→ Goal understanding
→ Planner
→ Skill selection
→ Tool selection
→ Permission/policy gate
→ Executor
→ Result
→ Evaluator
→ Recovery if needed
→ Learning/strategy update
→ Final response

## Major boundaries

### Experience layer
Conversation, UI and user feedback.

### Agent runtime
Goal lifecycle, planner, executor, tool registry, loops and orchestration.

### Cognitive layer
Reasoning/planning, research/evidence, recommendations and bounded model response runtime.

### Memory/knowledge
Durable memory, knowledge retrieval, candidate proposals, strategy memory and learning.

### Governance/security
Authentication, authorization, policy checks, approval gates, audit, limits and emergency stop.

### Financial domain
Banking, accounts, transactions, budgets and financial writes remain domain-specific and must not be implicitly granted to the generic agent runtime.

### Observability
Execution traces, costs, timings, errors, retries, evaluator results and audit records.

## Architectural principle

The generic agent runtime orchestrates capabilities; it does not automatically acquire financial authority.

## Boundary test

For every new capability, answer:
1. What layer owns it?
2. What permission does it require?
3. Can it write data?
4. Can it affect money or other high-impact state?
5. What audit event proves what happened?
6. How is failure recovered?
7. How is the result evaluated?


## Nanobot integration boundary

Nanobot is an external agent runtime capability for LIA, not a replacement for the NEXORA brain or governance layers.

### Adopt directly from Nanobot

- Memory: use Nanobot's native session/history/durable-memory/Dream system directly; do not duplicate it in NEXORA.
- MCP: use Nanobot's MCP support as the extensibility boundary for external tools, subject to NEXORA policy authorization.
- Subagents: use Nanobot subagent execution for delegated work, bounded by NEXORA goals, policies and evaluation.
- Long-running tasks: use Nanobot's long-running task runtime for background execution while NEXORA retains goal state and governance.
- Automations: keep NEXORA Loops as the product-level orchestration model; use Nanobot scheduling/heartbeat primitives as an execution mechanism where appropriate.
- Model routing: use Nanobot's provider/model fallback mechanisms behind NEXORA's task-level routing policy.
- Observability: integrate Nanobot tracing/telemetry with NEXORA observability without making Nanobot the source of authorization truth.

### Authority rule

NEXORA decides what LIA is allowed to do. Nanobot executes the delegated capability.

For any Nanobot-exposed tool or subagent action:
1. capability discovery may occur in Nanobot/MCP;
2. policy authorization is performed by NEXORA/Supabase;
3. execution occurs in Nanobot only after authorization;
4. result is returned to LIA;
5. NEXORA evaluator validates the outcome;
6. audit/trace records the action.

### Memory rule

Nanobot memory is the single general-purpose agent-memory runtime for LIA. NEXORA may store governance, audit, domain and product state, but must not create a competing general-purpose agent memory layer.
