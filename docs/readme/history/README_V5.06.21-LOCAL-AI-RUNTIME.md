# NEXORA V5.06.21 — Local AI Runtime

NEXORA now has a native local inference boundary for GPT-OSS 20B. The application can auto-start a bundled/local `llama-server` process when the executable and GGUF model are present.

Expected runtime files:
- `runtime/llama/llama-server.exe` (Windows) or `llama-server` (Linux/macOS)
- `models/gpt-oss-20b.gguf`

Environment overrides:
- `NEXORA_LOCAL_ENGINE_BIN`
- `NEXORA_MODEL_PATH`
- `NEXORA_LOCAL_ENGINE_HOST`
- `NEXORA_LOCAL_ENGINE_PORT`
- `NEXORA_CONTEXT_LENGTH`
- `NEXORA_ENGINE_START_TIMEOUT_MS`
- `NEXORA_AI_TIMEOUT_MS`

The provider order is now native NEXORA local engine first, Ollama only as a compatibility fallback, then explicitly permitted remote inference, then deterministic fallback.

The model weights are intentionally not embedded in this ZIP: a 20B GGUF can be many GB and must match the user's hardware/quantization. The runtime is packaged so NEXORA can own startup and lifecycle instead of requiring the user to launch Ollama manually.
