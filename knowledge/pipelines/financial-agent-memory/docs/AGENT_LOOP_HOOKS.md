# Agent-loop hooks

Do not create a second agent-loop system.

Use the existing Nexora tables and orchestration.

## Before reasoning

Create/reuse the current `agent_loop_step` for knowledge retrieval.
Call `retrieve-financial-knowledge` with:
- task/query
- domain
- current run ID
- embedding
- confidence threshold

Persist every selected knowledge item in `agent_knowledge_retrievals`.

## During reasoning

Expose only the normalized statement plus provenance and risk metadata.
Do not dump full source documents into the prompt.

## Before action

The agent must separately retrieve:
1. user authorization
2. current financial facts
3. applicable policy
4. knowledge/evidence

Knowledge item != authorization.

## After action

Record:
- tool/action
- authorization decision
- knowledge IDs used
- source IDs
- evidence
- outcome
- evaluation

Use the existing `agent_evidence` table where compatible.

## Learning

Only update semantic/persistent knowledge through the validation pipeline.
Use episodic/decision memory for what Nexora observed and did.
Never let an agent run directly mutate safety or authorization policies.
