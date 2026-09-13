# NEXORA AI OS

## Objective

NEXORA LIA is designed as an application-owned cognitive system rather than a thin UI wrapper around one hosted model.

The architecture separates five responsibilities:

1. **NEXORA Brain** — model inference behind an application-owned provider contract.
2. **Cognitive kernels** — reasoning, planning, critique, decision, reflection, epistemic and causal checks.
3. **Skills / tools** — bounded capabilities that can read or mutate specific financial domains.
4. **Memory** — Supabase durable memory + semantic retrieval + Obsidian graph memory.
5. **Governance** — authentication, authorization, consent, action boundaries, audit and verification.

## Source of truth

- Supabase is authoritative for balances, transactions, accounts, budgets, goals and permissions.
- Vector retrieval is an index, never the financial source of truth.
- Obsidian is the human-readable cognitive/graph layer. It can contain summaries, concepts, research, preferences and links, but it must not override transactional data.

## Brain boundary

The application calls `src/lib/lia/brain` through an OpenAI-compatible HTTP contract:

- `POST /chat/completions`
- `GET /health`

This deliberately avoids coupling LIA to Ollama or to a hosted vendor. A self-hosted llama.cpp runtime can implement the contract during the transition to a NEXORA-specific model.

The model weights are **not** bundled into the Next.js/Vercel deployment. They belong to the inference runtime. This is a technical requirement: a useful LLM needs model weights and an inference engine, and serverless web deployments are not an appropriate place to package a large model.

## Migration path

### Phase A — provider decoupling

Complete: NEXORA Brain is now a first-class provider boundary and is tried before legacy local inference when configured.

### Phase B — self-hosted inference

Run a dedicated NEXORA Brain runtime outside the Next.js serverless process. Configure:

```text
NEXORA_BRAIN_API_URL=https://<brain-runtime>/v1
NEXORA_BRAIN_MODEL=nexora-lia
LIA_PROVIDER_MODE=native_only
```

The runtime can initially use an open-weight base model through llama.cpp. NEXORA owns the API boundary, prompts, tools, memory, governance, evaluations and deployment policy.

### Phase C — NEXORA model specialization

Build a curated training/evaluation corpus from:

- financial-domain instructions;
- NEXORA skill/tool traces;
- verified reasoning examples;
- refusal and safety cases;
- French financial vocabulary and user interactions;
- research/evidence synthesis examples;
- structured tool-calling examples.

Use supervised fine-tuning and, where justified, preference optimization/distillation. Do not train from scratch until the data, evaluation suite and compute budget justify it.

### Phase D — dual-model LIA

Introduce two model profiles behind the same brain contract:

- `nexora-lia-core`: fast routing, extraction, classification, simple conversation and tool selection.
- `nexora-lia-reasoner`: complex financial reasoning, scenarios, research synthesis and multi-step planning.

The deterministic kernels remain authoritative for calculations, permissions and high-risk decisions.

## Memory loop

```text
interaction
   ↓
working context
   ↓
semantic retrieval
   ↓
financial truth (Supabase) + cognitive memory (Obsidian)
   ↓
reasoning / planning
   ↓
tool or skill execution
   ↓
verification
   ↓
curated memory candidate
   ↓
Obsidian graph + durable memory
```

Memory is governed: explicit memory requests create candidates, and sensitive personalization requires the existing consent gate.

## Agent loop

```text
Observe → Understand → Reason → Route → Act → Verify → Remember
```

Every mutating financial action must remain behind the existing action planner, governance and audit boundaries.

## Deployment rule

Vercel hosts the Next.js application and API layer. The NEXORA Brain inference runtime is a separate compute workload unless a deliberately small browser/local model is used. This separation prevents model inference from becoming coupled to Vercel serverless limits.

## Immediate environment

Copy the relevant values from `.env.example`. For the no-Ollama target, the intended production state is:

```text
LIA_PROVIDER_MODE=native_only
LIA_ALLOW_REMOTE_FALLBACK=false
OLLAMA_ENABLED=false
NEXORA_BRAIN_API_URL=<your NEXORA Brain runtime>
NEXORA_BRAIN_MODEL=nexora-lia
```

Do not put private inference keys in `NEXT_PUBLIC_*` variables.
