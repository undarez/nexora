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
