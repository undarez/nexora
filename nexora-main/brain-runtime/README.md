# NEXORA Brain Runtime

Self-hosted inference runtime for the NEXORA Brain contract.

## Contract

The runtime exposes:

- `POST /chat/completions`
- `GET /health`

The request/response shape is OpenAI-compatible so the Next.js application does not depend on Ollama or a hosted AI vendor.

## Model

The runtime loads a local GGUF model. The model file is intentionally **not** committed to GitHub.

Set:

```text
NEXORA_MODEL_PATH=/models/nexora-lia.gguf
NEXORA_MODEL_NAME=nexora-lia
NEXORA_HOST=0.0.0.0
NEXORA_PORT=8080
NEXORA_N_CTX=8192
NEXORA_N_THREADS=8
NEXORA_N_GPU_LAYERS=-1
NEXORA_BRAIN_API_KEY=
```

A strong open-weight instruct model can be used initially. Later, replace it with a NEXORA fine-tuned/distilled model without changing the application API.

## Docker

Build:

```bash
docker build -t nexora-brain ./brain-runtime
```

Run with a local model directory mounted at `/models`:

```bash
docker run --rm -p 8080:8080 \
  -v /path/to/models:/models:ro \
  -e NEXORA_MODEL_PATH=/models/nexora-lia.gguf \
  nexora-brain
```

For production, put the runtime behind HTTPS and a network boundary. Set `NEXORA_BRAIN_API_KEY` and configure the same value as `NEXORA_BRAIN_API_KEY` in Vercel.

## Architecture rule

Supabase remains the financial source of truth. The Brain only reasons over context supplied by the application. It must never receive Supabase service-role credentials and must never directly mutate financial tables.
